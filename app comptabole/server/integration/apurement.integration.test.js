import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import {
  api,
  connecterAdmin,
  creerBaseJetable,
  demarrerServeur,
} from "./helpers.js";
import jwt from "jsonwebtoken";
import XLSX from "xlsx";
import { hash } from "../apurement/audit.js";
import { sendDueReminders } from "../apurement/reminders.js";
vi.setConfig({ testTimeout: 30000, hookTimeout: 60000 });
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Apurement PostgreSQL isolated",
  () => {
    let base,
      server,
      admin,
      sql,
      soc,
      other,
      supplier,
      auth,
      bc,
      invoice,
      collab,
      client,
      stock,
      declaration,
      approvedInvoice,
      approvedStock,
      proofId,
      approvedHash;
    beforeAll(async () => {
      base = await creerBaseJetable();
      server = await demarrerServeur(base.url);
      admin = await connecterAdmin(server.base);
      sql = await base.client();
      soc = (
        await sql.query(
          "insert into societes(raison_sociale,code) values('Synthétique Apurement','APT') returning id",
        )
      ).rows[0].id;
      other = (
        await sql.query(
          "insert into societes(raison_sociale,code) values('Autre société','APX') returning id",
        )
      ).rows[0].id;
      const employee = async (role, scope) =>
        (
          await sql.query(
            `insert into employes(nom,prenom,identifiant,mot_de_passe,role,societes_assignees,societe_id)
      values('Test',$1,$1,'',$2,$3,$4) returning id`,
            [
              role,
              role,
              JSON.stringify(scope),
              role === "societe_employe" ? soc : null,
            ],
          )
        ).rows[0].id;
      collab = api(
        server.base,
        jwt.sign(
          {
            role: "employe",
            employeId: await employee("collaborateur", [soc]),
          },
          server.env.JWT_SECRET,
        ),
      );
      client = api(
        server.base,
        jwt.sign(
          { role: "employe", employeId: await employee("societe_employe", []) },
          server.env.JWT_SECRET,
        ),
      );
    });
    afterAll(async () => {
      await sql?.end();
      await server?.arreter();
      await base?.supprimer();
    });
    const create = async (kind, body) => {
      const r = await admin("POST", `/api/apurement/${kind}`, {
        societeId: soc,
        ...body,
      });
      expect(r.status, r.texte).toBe(201);
      return r.json;
    };
    it("replays additive migration twice on populated DB", async () => {
      const schema = readFileSync(
        new URL("../apurement/schema.sql", import.meta.url),
        "utf8",
      );
      await sql.query(schema);
      await sql.query(schema);
      expect(
        (await sql.query("select count(*)::int n from societes")).rows[0].n,
      ).toBe(2);
    });
    it("denies every company-side request before parsing; scopes staff", async () => {
      for (const path of [
        "factures",
        "autorisations",
        "fournisseurs",
        "bcs",
        "pieces",
        "controles",
        "imports/00000000-0000-4000-8000-000000000001/rapport",
        "exports/00000000-0000-4000-8000-000000000001/telecharger",
      ])
        expect(
          (await client("GET", `/api/apurement/${path}?societeId=${soc}`))
            .status,
        ).toBe(403);
      expect(
        (await collab("GET", `/api/apurement/factures?societeId=${other}`))
          .status,
      ).toBe(403);
    });
    it("creates one authorization, multiple supplier-specific BCs and standalone purchase", async () => {
      supplier = await create("fournisseurs", {
        raisonSociale: "Fournisseur synthétique",
        matriculeFiscalRaw: "TEST-MF",
        matriculeFiscalNormalise: "TEST-MF",
      });
      auth = await create("autorisations", { numero: "000039" });
      bc = await create("bcs", {
        numero: "000040",
        autorisationId: auth.id,
        fournisseurId: supplier.id,
        dateBc: "2026-07-01",
      });
      await create("bcs", {
        numero: "000041",
        autorisationId: auth.id,
        fournisseurId: supplier.id,
      });
      invoice = await create("factures", {
        bcId: bc.id,
        fournisseurId: supplier.id,
        numeroFacture: "000128",
        dateFacture: "2026-08-15",
        datePrecision: "day",
        montantHtMillimes: "1444800",
        tauxTvaBps: 1900,
        annee: 2026,
        trimestre: "T3",
      });
      expect(invoice.tvaSuspendueMillimes).toBe("274512");
      expect(invoice.montantHtMillimes).toBe("1444800");
      expect(
        (await sql.query("select count(*)::int n from stock_mouvements"))
          .rows[0].n,
      ).toBe(0);
    });
    it("rejects cross-company relations and supplier changes inconsistent with BC", async () => {
      const alien = await create("fournisseurs", {
        societeId: other,
        raisonSociale: "Autre fournisseur",
      });
      const r = await admin("POST", "/api/apurement/bcs", {
        societeId: soc,
        numero: "X",
        autorisationId: auth.id,
        fournisseurId: alien.id,
      });
      expect(r.status).toBe(422);
      const another = await create("fournisseurs", {
        raisonSociale: "Deuxième fournisseur",
      });
      expect(
        (
          await admin("PATCH", `/api/apurement/factures/${invoice.id}`, {
            expectedVersion: invoice.version,
            fournisseurId: another.id,
          })
        ).status,
      ).toBe(422);
    });
    it("detects two-tab revision races and retains manual VAT with audit", async () => {
      const responses = await Promise.all(
        ["A", "B"].map((n) =>
          admin("PATCH", `/api/apurement/factures/${invoice.id}`, {
            expectedVersion: invoice.version,
            numeroFacture: n,
          }),
        ),
      );
      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
      invoice = responses.find((r) => r.status === 200).json;
      const r = await admin("PATCH", `/api/apurement/factures/${invoice.id}`, {
        expectedVersion: invoice.version,
        tvaMode: "manuel",
        tvaSuspendueMillimes: "274511",
        motifCorrection: "Justificatif contrôlé",
      });
      expect(r.status, r.texte).toBe(200);
      invoice = r.json;
      expect(invoice.tvaCalculeeMillimes).toBe("274512");
      expect(invoice.tvaSuspendueMillimes).toBe("274511");
      const controls = await collab(
        "GET",
        `/api/apurement/controles?societeId=${soc}&annee=2026&trimestre=T3`,
      );
      expect(controls.status, controls.texte).toBe(200);
      expect(
        controls.json.controls.some((c) => c.code === "TVA_MANUELLE"),
      ).toBe(true);
      expect(
        (
          await sql.query(
            "select count(*)::int n from apurement_audit where entity_id=$1",
            [invoice.id],
          )
        ).rows[0].n,
      ).toBe(3);
    });
    it("domain audit is append-only; existing societies cannot cascade-delete fiscal data", async () => {
      await expect(
        sql.query("delete from apurement_audit where entity_id=$1", [
          invoice.id,
        ]),
      ).rejects.toThrow(/immuable/);
      await expect(
        sql.query("delete from societes where id=$1", [soc]),
      ).rejects.toThrow();
    });
    it("explicitly links one multi-line Stock purchase, synchronizes both directions and retains manual VAT", async () => {
      const r = await admin("POST", "/api/stock/mouvements", {
        societeId: soc,
        fournisseur: supplier.raisonSociale,
        achatNumFacture: "STOCK-128",
        achatDate: "2026-08-15",
        achatLignes: [
          {
            designation: "A",
            quantite: 2,
            prixUnitaire: 500,
            montantTnd: 1000,
          },
          {
            designation: "B",
            quantite: 1,
            prixUnitaire: 444.8,
            montantTnd: 444.8,
          },
        ],
      });
      expect(r.status, r.texte).toBe(201);
      stock = r.json;
      const suggestions = await admin(
        "POST",
        "/api/apurement/stock/suggestions",
        { societeId: soc },
      );
      expect(suggestions.status, suggestions.texte).toBe(200);
      expect(suggestions.json.items).toHaveLength(1);
      const source = suggestions.json.items[0];
      expect(source.htMillimes).toBe("1444800");
      const link = await admin(
        "POST",
        `/api/apurement/factures/${invoice.id}/lier-stock`,
        {
          stockId: stock.id,
          stockHash: source.hash,
          expectedVersion: invoice.version,
          resolution: "stock",
          confirmer: true,
        },
      );
      expect(link.status, link.texte).toBe(200);
      invoice = link.json;
      expect(invoice.tvaSuspendueMillimes).toBe("274511");
      const patch = await admin("PATCH", `/api/stock/mouvements/${stock.id}`, {
        achatNumFacture: "STOCK-129",
        apurementRevision: stock.apurementRevision,
      });
      expect(patch.status, patch.texte).toBe(200);
      invoice = (await admin("GET", `/api/apurement/factures/${invoice.id}`))
        .json;
      expect(invoice.numeroFacture).toBe("STOCK-129");
      expect(invoice.tvaSuspendueMillimes).toBe("274511");
      const back = await admin(
        "PATCH",
        `/api/apurement/factures/${invoice.id}`,
        { expectedVersion: invoice.version, numeroFacture: "AP-130" },
      );
      expect(back.status, back.texte).toBe(200);
      invoice = back.json;
      expect(
        (
          await sql.query(
            "select achat_num_facture from stock_mouvements where id=$1",
            [stock.id],
          )
        ).rows[0].achat_num_facture,
      ).toBe("AP-130");
      expect(
        (
          await sql.query(
            "select count(*)::int n from stock_lignes where mouvement_id=$1",
            [stock.id],
          )
        ).rows[0].n,
      ).toBe(2);
      const stale = await admin("PATCH", `/api/stock/mouvements/${stock.id}`, {
        achatNumFacture: "ONGLET_PERIME",
        apurementRevision: stock.apurementRevision,
      });
      expect(stale.status, stale.texte).toBe(409);
      expect(stale.json.code).toBe("CONFLIT_SYNCHRO");
      const missing = await admin(
        "PATCH",
        `/api/stock/mouvements/${stock.id}`,
        { achatNumFacture: "ANCIEN_CLIENT" },
      );
      expect(missing.status).toBe(409);
      expect(missing.json.code).toBe("VERSION_STOCK_REQUISE");
    });
    it("rolls back unsafe reverse monetary updates and blocks linked Stock deletion", async () => {
      const r = await admin("PATCH", `/api/apurement/factures/${invoice.id}`, {
        expectedVersion: invoice.version,
        montantHtMillimes: "2000000",
      });
      expect(r.status, r.texte).toBe(409);
      expect(r.json.code).toBe("ALLOCATION_STOCK_REQUISE");
      expect(
        (await admin("GET", `/api/apurement/factures/${invoice.id}`)).json
          .montantHtMillimes,
      ).toBe("1444800");
      expect(
        (await admin("DELETE", `/api/stock/mouvements/${stock.id}`)).status,
      ).toBe(409);
      const current = (
        await admin("GET", `/api/stock/mouvements?societeId=${soc}`)
      ).json.find((m) => m.id === stock.id);
      const precision = await admin(
        "PATCH",
        `/api/stock/mouvements/${stock.id}`,
        {
          apurementRevision: current.apurementRevision,
          achatLignes: [
            {
              designation: "A",
              quantite: 2,
              prixUnitaire: 500,
              montantTnd: 1000.0001,
            },
            {
              designation: "B",
              quantite: 1,
              prixUnitaire: 444.8,
              montantTnd: 444.8,
            },
          ],
        },
      );
      expect(precision.status, precision.texte).toBe(422);
      expect(precision.json.code).toBe("PRECISION_STOCK");
      expect(
        (
          await sql.query(
            "select sum(montant_tnd)::text as total from stock_lignes where mouvement_id=$1 and categorie='achat'",
            [stock.id],
          )
        ).rows[0].total,
      ).toBe("1444.8");
    });
    it("reuses Collecte evidence, refuses cross-tenant sources and preserves bytes after source deletion", async () => {
      const collecte = (
        await sql.query(
          "insert into collectes(societe_id,periode) values($1,'2026-07') returning id",
          [soc],
        )
      ).rows[0].id;
      const raw =
        "data:application/pdf;base64," +
        Buffer.from("%PDF-1.4\nSynthetic evidence\n%%EOF").toString("base64");
      const source = (
        await sql.query(
          "insert into collecte_fichiers(collecte_id,nom,data_url) values($1,'synthetique.pdf',$2) returning id",
          [collecte, raw],
        )
      ).rows[0].id;
      const body = {
        societeId: soc,
        parentType: "facture",
        parentId: invoice.id,
        source: "collecte_fichier",
        sourceId: source,
      };
      const linked = await admin("POST", "/api/apurement/pieces", body);
      expect(linked.status, linked.texte).toBe(201);
      const alien = await admin("POST", "/api/apurement/pieces", {
        ...body,
        societeId: other,
      });
      expect(alien.status).toBe(404);
      await sql.query("delete from collecte_fichiers where id=$1", [source]);
      const file = await admin(
        "GET",
        `/api/apurement/pieces/${linked.json.id}/telecharger`,
      );
      expect(file.status).toBe(200);
      expect(file.texte).toContain("Synthetic evidence");
      const list = await admin(
        "GET",
        `/api/apurement/pieces?societeId=${soc}&parentType=facture&parentId=${invoice.id}`,
      );
      expect(list.texte).not.toContain("base64");
      expect(
        list.json.find((p) => p.id === linked.json.id).sourceDisponible,
      ).toBe(false);
      expect(
        (
          await client(
            "GET",
            `/api/apurement/pieces/${linked.json.id}/telecharger`,
          )
        ).status,
      ).toBe(403);
    });
    it("internal missing-evidence notifications never reach company accounts", async () => {
      const r = await admin("POST", "/api/apurement/pieces-manquantes", {
        societeId: soc,
        parentType: "facture",
        parentId: invoice.id,
        libelle: "Preuve synthétique",
      });
      expect(r.status, r.texte).toBe(201);
      expect(
        (
          await sql.query(
            "select count(*)::int n from notifications n join employes e on e.id::text=n.user_key where n.type='apurement' and e.role='societe_employe'",
          )
        ).rows[0].n,
      ).toBe(0);
      expect(
        (
          await sql.query(
            "select count(*)::int n from notifications where type='apurement'",
          )
        ).rows[0].n,
      ).toBeGreaterThan(0);
    });
    it("hides historical Apurement notifications after a role or company-scope change", async () => {
      const employee = (
        await sql.query(
          "select id from employes where identifiant='collaborateur'",
        )
      ).rows[0];
      expect(
        (await collab("GET", "/api/notifications")).json.some(
          (n) => n.type === "apurement",
        ),
      ).toBe(true);
      try {
        await sql.query(
          "update employes set societes_assignees='[]'::jsonb where id=$1",
          [employee.id],
        );
        expect(
          (await collab("GET", "/api/notifications")).json.some(
            (n) => n.type === "apurement",
          ),
        ).toBe(false);
        expect(
          (await collab("GET", "/api/data/bootstrap")).json.notifications.some(
            (n) => n.type === "apurement",
          ),
        ).toBe(false);
        await sql.query(
          "update employes set role='societe_employe',societe_id=$2 where id=$1",
          [employee.id, soc],
        );
        expect(
          (await collab("GET", "/api/notifications")).json.some(
            (n) => n.type === "apurement",
          ),
        ).toBe(false);
        expect(
          (await collab("GET", "/api/data/bootstrap")).json.notifications.some(
            (n) => n.type === "apurement",
          ),
        ).toBe(false);
      } finally {
        await sql.query(
          "update employes set role='collaborateur',societe_id=null,societes_assignees=$2 where id=$1",
          [employee.id, JSON.stringify([soc])],
        );
      }
    });
    it("previews imports without domain writes, commits exact partial dates once and rejects guessed batches", async () => {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([
          [
            "Autorisation",
            "Numero BC",
            "Date BC",
            "Numero Facture",
            "Date facture",
            "MF",
            "Raison sociale",
            "Prix HT",
            "TVA",
            "Objet",
          ],
          [
            "IMPORT-AUT",
            "000042",
            "01/07/2026",
            "0000123",
            "07/2026",
            "SYNTHETIQUE-MF",
            "IMPORT FOURNISSEUR",
            "1000.000",
            "190.000",
            "ACHAT",
          ],
        ]),
        "Factures",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([
          ["Nom et Prénom ou Raison sociale :", "SOCIETE SOURCE SYNTHETIQUE"],
          ["M.F. :", "8888888AB000"],
        ]),
        "Société",
      );
      const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      const before = (
        await sql.query("select count(*)::int n from apurement_factures")
      ).rows[0].n;
      const preview = await admin("POST", "/api/apurement/imports/preview", {
        societeId: soc,
        annee: 2026,
        trimestre: "T3",
        nom: "synthetique.xlsx",
        contenuBase64: bytes.toString("base64"),
        tauxTvaBps: 1900,
      });
      expect(preview.status, preview.texte).toBe(200);
      expect(preview.json.rows[0].datePrecision).toBe("month");
      expect(
        (await sql.query("select count(*)::int n from apurement_factures"))
          .rows[0].n,
      ).toBe(before);
      expect(
        (
          await client(
            "GET",
            `/api/apurement/imports/${preview.json.batchId}/rapport`,
          )
        ).status,
      ).toBe(403);
      const body = {
        previewHash: preview.json.previewHash,
        rows: [{ row: 2 }],
      };
      const commit = await admin(
        "POST",
        `/api/apurement/imports/${preview.json.batchId}/commit`,
        body,
      );
      expect(commit.status, commit.texte).toBe(200);
      const repeat = await admin(
        "POST",
        `/api/apurement/imports/${preview.json.batchId}/commit`,
        body,
      );
      expect(repeat.json).toEqual(commit.json);
      expect(
        (await sql.query("select count(*)::int n from apurement_factures"))
          .rows[0].n,
      ).toBe(before + 1);
      const f = (
        await sql.query("select * from apurement_factures where id=$1", [
          commit.json[0].factureId,
        ])
      ).rows[0];
      expect(f.date_facture).toBeNull();
      expect(f.date_brute).toBe("07/2026");
      // A changed file can update only an explicitly selected, reviewed revision.
      XLSX.utils.sheet_add_aoa(
        workbook.Sheets.Factures,
        [["1100.000", "209.000"]],
        { origin: "H2" },
      );
      const changed = await admin("POST", "/api/apurement/imports/preview", {
        societeId: soc,
        annee: 2026,
        trimestre: "T3",
        nom: "synthetique-corrige.xlsx",
        contenuBase64: XLSX.write(workbook, {
          type: "buffer",
          bookType: "xlsx",
        }).toString("base64"),
        tauxTvaBps: 1900,
      });
      expect(changed.status, changed.texte).toBe(200);
      expect(changed.json.rows[0].matches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: f.id,
            version: f.version,
            ht: "1000000",
          }),
        ]),
      );
      const updateBody = {
        previewHash: changed.json.previewHash,
        rows: [
          {
            row: 2,
            updateFactureId: f.id,
            expectedVersion: f.version,
            motif: "Correction confirmée sur la pièce fournisseur",
          },
        ],
      };
      const wrong = await admin(
        "POST",
        `/api/apurement/imports/${changed.json.batchId}/commit`,
        {
          ...updateBody,
          rows: [{ ...updateBody.rows[0], updateFactureId: invoice.id }],
        },
      );
      expect(wrong.status).toBe(422);
      const updated = await admin(
        "POST",
        `/api/apurement/imports/${changed.json.batchId}/commit`,
        updateBody,
      );
      expect(updated.status, updated.texte).toBe(200);
      expect(updated.json[0]).toMatchObject({
        factureId: f.id,
        action: "mis_a_jour",
        version: f.version + 1,
      });
      expect(
        (
          await sql.query(
            "select montant_ht_millimes,version from apurement_factures where id=$1",
            [f.id],
          )
        ).rows[0],
      ).toEqual({ montant_ht_millimes: "1100000", version: f.version + 1 });
      expect(
        (await sql.query("select count(*)::int n from apurement_factures"))
          .rows[0].n,
      ).toBe(before + 1);
      expect(
        (
          await admin(
            "POST",
            `/api/apurement/imports/${changed.json.batchId}/commit`,
            updateBody,
          )
        ).json,
      ).toEqual(updated.json);
      XLSX.utils.sheet_add_aoa(
        workbook.Sheets.Factures,
        [["1200.000", "228.000"]],
        { origin: "H2" },
      );
      const stale = await admin("POST", "/api/apurement/imports/preview", {
        societeId: soc,
        annee: 2026,
        trimestre: "T3",
        nom: "synthetique-concurrent.xlsx",
        contenuBase64: XLSX.write(workbook, {
          type: "buffer",
          bookType: "xlsx",
        }).toString("base64"),
        tauxTvaBps: 1900,
      });
      expect(stale.status, stale.texte).toBe(200);
      await sql.query(
        "update apurement_factures set version=version+1 where id=$1",
        [f.id],
      );
      const conflict = await admin(
        "POST",
        `/api/apurement/imports/${stale.json.batchId}/commit`,
        {
          previewHash: stale.json.previewHash,
          rows: [{ ...updateBody.rows[0], expectedVersion: f.version + 1 }],
        },
      );
      expect(conflict.status, conflict.texte).toBe(409);
      expect(
        (
          await sql.query(
            "select montant_ht_millimes from apurement_factures where id=$1",
            [f.id],
          )
        ).rows[0].montant_ht_millimes,
      ).toBe("1100000");
      expect(
        (
          await sql.query(
            "select committed_at from apurement_imports where id=$1",
            [stale.json.batchId],
          )
        ).rows[0].committed_at,
      ).toBeNull();
    });
    it("requires a reason to map an import to an existing BC and rechecks duplicates at commit", async () => {
      const makeFile = (number, name) => {
        const w = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
          w,
          XLSX.utils.aoa_to_sheet([
            [
              "Autorisation",
              "Numero BC",
              "Date BC",
              "Numero Facture",
              "Date facture",
              "MF",
              "Raison sociale",
              "Prix HT",
              "TVA",
              "Objet",
            ],
            [
              auth.numero,
              bc.numero,
              "01/07/2026",
              number,
              "20/08/2026",
              supplier.matriculeFiscalRaw,
              name,
              "1000.000",
              "190.000",
              "ACHAT",
            ],
          ]),
          "Factures",
        );
        return XLSX.write(w, { type: "buffer", bookType: "xlsx" }).toString(
          "base64",
        );
      };
      const previewFile = (content) =>
        admin("POST", "/api/apurement/imports/preview", {
          societeId: soc,
          annee: 2026,
          trimestre: "T3",
          nom: "mapping.xlsx",
          contenuBase64: content,
          tauxTvaBps: 1900,
        });
      const count = (
        await sql.query(
          "select count(*)::int n from apurement_fournisseurs where societe_id=$1",
          [soc],
        )
      ).rows[0].n;
      const p = await previewFile(
        makeFile("MAP-001", "NOM HISTORIQUE SUR LA SOURCE"),
      );
      expect(p.status, p.texte).toBe(200);
      const decision = {
        previewHash: p.json.previewHash,
        rows: [{ row: 2, bcId: bc.id }],
      };
      const noReason = await admin(
        "POST",
        `/api/apurement/imports/${p.json.batchId}/commit`,
        decision,
      );
      expect(noReason.status, noReason.texte).toBe(422);
      const mapped = await admin(
        "POST",
        `/api/apurement/imports/${p.json.batchId}/commit`,
        {
          ...decision,
          rows: [
            {
              row: 2,
              bcId: bc.id,
              motif:
                "Même matricule vérifié, nom historique contrôlé sur la pièce",
            },
          ],
        },
      );
      expect(mapped.status, mapped.texte).toBe(200);
      expect(
        (
          await sql.query(
            "select count(*)::int n from apurement_fournisseurs where societe_id=$1",
            [soc],
          )
        ).rows[0].n,
      ).toBe(count);
      const race = await previewFile(
        makeFile("RACE-IMPORT", supplier.raisonSociale),
      );
      expect(race.status, race.texte).toBe(200);
      expect(race.json.rows[0].duplicate).toBe(false);
      await create("factures", {
        bcId: bc.id,
        fournisseurId: supplier.id,
        numeroFacture: "RACE-IMPORT",
        dateFacture: "2026-08-20",
        datePrecision: "day",
        montantHtMillimes: "1000000",
        tauxTvaBps: 1900,
        annee: 2026,
        trimestre: "T3",
      });
      const stale = await admin(
        "POST",
        `/api/apurement/imports/${race.json.batchId}/commit`,
        { previewHash: race.json.previewHash, rows: [{ row: 2 }] },
      );
      expect(stale.status, stale.texte).toBe(409);
      expect(stale.json.code).toBe("IMPORT_DONNEES_MODIFIEES");
    });
    it("requires renewed review after a supplier fiscal identity correction", async () => {
      const first = await admin(
        "PATCH",
        `/api/apurement/fournisseurs/${supplier.id}`,
        {
          expectedVersion: supplier.version,
          matriculeFiscalNormalise: "TEST-MF-REV",
        },
      );
      expect(first.status, first.texte).toBe(200);
      let controls = (
        await admin(
          "GET",
          `/api/apurement/controles?societeId=${soc}&annee=2026&trimestre=T3`,
        )
      ).json.controls;
      const warning = controls.find(
        (c) =>
          c.factureId === invoice.id &&
          c.code === "IDENTITE_FOURNISSEUR_CORRIGEE",
      );
      expect(warning).toBeTruthy();
      const reviewed = await admin(
        "POST",
        `/api/apurement/controles/${invoice.id}/ack`,
        {
          code: warning.code,
          fingerprint: warning.fingerprint,
          motif: "Identité contrôlée sur la pièce",
        },
      );
      expect(reviewed.status, reviewed.texte).toBe(200);
      const second = await admin(
        "PATCH",
        `/api/apurement/fournisseurs/${supplier.id}`,
        {
          expectedVersion: first.json.version,
          matriculeFiscalNormalise: "TEST-MF-REV2",
        },
      );
      expect(second.status).toBe(200);
      controls = (
        await admin(
          "GET",
          `/api/apurement/controles?societeId=${soc}&annee=2026&trimestre=T3`,
        )
      ).json.controls;
      expect(
        controls.find(
          (c) => c.factureId === invoice.id && c.code === warning.code,
        ).ack,
      ).toBeNull();
    });
    it("prepares a complete quarter, freezes only after documented rounding sign-off and rejects collaborator approval", async () => {
      const supplier2 = await create("fournisseurs", {
        raisonSociale: "SYNTHETIQUE EXPORT",
        matriculeFiscalRaw: "7654321ABC000",
        matriculeFiscalNormalise: "7654321ABC000",
      });
      const bc2 = await create("bcs", {
        numero: "000042",
        autorisationId: auth.id,
        fournisseurId: supplier2.id,
        dateBc: "2026-10-01",
      });
      approvedInvoice = await create("factures", {
        bcId: bc2.id,
        fournisseurId: supplier2.id,
        numeroFacture: "F-Q4",
        dateFacture: "2026-10-15",
        datePrecision: "day",
        montantHtMillimes: "1000000",
        tauxTvaBps: 1900,
        annee: 2026,
        trimestre: "T4",
      });
      approvedStock = (
        await admin("POST", "/api/stock/mouvements", {
          societeId: soc,
          fournisseur: supplier2.raisonSociale,
          achatNumFacture: "F-Q4",
          achatDate: "2026-10-15",
          achatLignes: [
            {
              designation: "A",
              quantite: 1,
              prixUnitaire: 1000,
              montantTnd: 1000,
            },
          ],
        })
      ).json;
      const source = (
        await admin("POST", "/api/apurement/stock/suggestions", {
          societeId: soc,
        })
      ).json.items.find((s) => s.id === approvedStock.id);
      approvedInvoice = (
        await admin(
          "POST",
          `/api/apurement/factures/${approvedInvoice.id}/lier-stock`,
          {
            stockId: source.id,
            stockHash: source.hash,
            expectedVersion: approvedInvoice.version,
            resolution: "stock",
            confirmer: true,
          },
        )
      ).json;
      const dataUrl =
        "data:application/pdf;base64," +
        Buffer.from("%PDF-1.4\nSynthetic review proof\n%%EOF").toString(
          "base64",
        );
      const attach = async (parentType, parentId) => {
        const r = await admin("POST", "/api/apurement/pieces", {
          societeId: soc,
          parentType,
          parentId,
          source: "apurement_upload",
          nom: "preuve.pdf",
          dataUrl,
        });
        expect(r.status, r.texte).toBe(201);
        return r.json.id;
      };
      await attach("autorisation", auth.id);
      await attach("bc", bc2.id);
      await attach("facture", approvedInvoice.id);
      const profil = await admin(
        "PUT",
        `/api/apurement/societes/${soc}/profil`,
        {
          expectedVersion: 0,
          verifier: true,
          donnees: {
            raisonSociale: "SYNTHETIQUE",
            matriculeFiscal: "1234567AB000",
            activite: "INDUSTRIE",
            ville: "TUNIS",
            rue: "RUE TEST",
            numero: "1",
            codePostal: "1000",
            reference: "Vérification synthétique",
          },
        },
      );
      expect(profil.status, profil.texte).toBe(200);
      const draft = await admin("POST", "/api/apurement/declarations", {
        societeId: soc,
        annee: 2026,
        trimestre: "T4",
      });
      expect(draft.status, draft.texte).toBe(201);
      declaration = draft.json;
      const test = await admin(
        "POST",
        `/api/apurement/declarations/${declaration.id}/exports`,
        { type: "bcd-test" },
      );
      expect(test.status, test.texte).toBe(200);
      expect(test.json.nom).toContain("TEST_NON_OFFICIEL");
      const draftReport = await admin(
        "POST",
        `/api/apurement/declarations/${declaration.id}/exports`,
        { type: "excel" },
      );
      expect(draftReport.status, draftReport.texte).toBe(200);
      expect(draftReport.json.nom).toContain("BROUILLON_NON_VALIDE");
      expect(
        (await admin("GET", `/api/apurement/declarations/${declaration.id}`))
          .json.statut,
      ).toBe("brouillon");
      const review = await collab(
        "POST",
        `/api/apurement/declarations/${declaration.id}/soumettre-validation`,
      );
      expect(review.status, review.texte).toBe(200);
      expect(
        (
          await collab(
            "POST",
            `/api/apurement/declarations/${declaration.id}/valider`,
            {},
          )
        ).status,
      ).toBe(403);
      const blocked = await admin(
        "POST",
        `/api/apurement/declarations/${declaration.id}/valider`,
        {},
      );
      expect(blocked.status, blocked.texte).toBe(423);
      proofId = await attach("declaration", declaration.id);
      const policy = await admin("PUT", "/api/apurement/politique-calcul", {
        societeId: soc,
        mode: "demi_superieur_facture",
        reference: "SYNTHETIC ONLY - internal line half-up approved for test",
        preuveId: proofId,
        confirmer: true,
      });
      expect(policy.status, policy.texte).toBe(200);
      const staleControlHash = (
        await admin("GET", `/api/apurement/declarations/${declaration.id}`)
      ).json.controlHash;
      const editBeforeApproval = await admin(
        "PATCH",
        `/api/apurement/factures/${approvedInvoice.id}`,
        {
          expectedVersion: approvedInvoice.version,
          objet: "Modification concurrente avant validation",
        },
      );
      expect(editBeforeApproval.status, editBeforeApproval.texte).toBe(200);
      const staleApproval = await admin(
        "POST",
        `/api/apurement/declarations/${declaration.id}/valider`,
        { expectedControlHash: staleControlHash },
      );
      expect(staleApproval.status, staleApproval.texte).toBe(409);
      expect(staleApproval.json.code).toBe("CONTROLES_MODIFIES");
      const approved = await admin(
        "POST",
        `/api/apurement/declarations/${declaration.id}/valider`,
        {
          expectedControlHash: (
            await admin("GET", `/api/apurement/declarations/${declaration.id}`)
          ).json.controlHash,
        },
      );
      expect(approved.status, approved.texte).toBe(200);
      declaration = approved.json;
      approvedHash = declaration.snapshotHash;
      expect(approvedHash).toBe(hash(declaration.snapshot));
      await expect(
        sql.query(
          "update apurement_declarations set snapshot='{}' where id=$1",
          [declaration.id],
        ),
      ).rejects.toThrow(/immuable/);
    });
    it("freezes Excel/PDF bytes, forbids official export and preserves snapshot across later Stock edits", async () => {
      const importedControls = await admin(
        "GET",
        `/api/apurement/controles?societeId=${soc}&annee=2026&trimestre=T3`,
      );
      expect(importedControls.status, importedControls.texte).toBe(200);
      expect(
        importedControls.json.controls.some(
          (c) => c.code === "DECLARANT_SOURCE_DIFFERENT",
        ),
      ).toBe(true);
      for (const type of ["excel", "pdf"]) {
        const first = await admin(
          "POST",
          `/api/apurement/declarations/${declaration.id}/exports`,
          { type },
        );
        expect(first.status, first.texte).toBe(200);
        const repeat = await admin(
          "POST",
          `/api/apurement/declarations/${declaration.id}/exports`,
          { type },
        );
        expect(repeat.json).toEqual(first.json);
        const file = await admin(
          "GET",
          `/api/apurement/exports/${first.json.id}/telecharger`,
        );
        expect(file.status).toBe(200);
        expect(file.entetes.get("x-content-sha256")).toBe(first.json.hash);
        const content = (
          await sql.query("select contenu from apurement_exports where id=$1", [
            first.json.id,
          ])
        ).rows[0].contenu;
        expect(hash(content)).toBe(first.json.hash);
        if (type === "excel") {
          const workbook = XLSX.read(content, { type: "buffer" });
          expect(workbook.SheetNames).toContain("Justificatifs");
        }
        if (type === "pdf")
          expect(content.subarray(0, 5).toString()).toBe("%PDF-");
        expect(
          (
            await client(
              "GET",
              `/api/apurement/exports/${first.json.id}/telecharger`,
            )
          ).status,
        ).toBe(403);
      }
      expect(
        (
          await admin(
            "POST",
            `/api/apurement/declarations/${declaration.id}/exports`,
            { type: "bcd-officiel" },
          )
        ).status,
      ).toBe(423);
      const edit = await admin(
        "PATCH",
        `/api/stock/mouvements/${approvedStock.id}`,
        {
          achatNumFacture: "AFTER-APPROVAL",
          apurementRevision: (
            await admin("GET", `/api/stock/mouvements?societeId=${soc}`)
          ).json.find((m) => m.id === approvedStock.id).apurementRevision,
        },
      );
      expect(edit.status, edit.texte).toBe(200);
      const live = await admin(
        "GET",
        `/api/apurement/factures/${approvedInvoice.id}`,
      );
      expect(live.json.conflit).toBeTruthy();
      const frozen = await admin(
        "GET",
        `/api/apurement/declarations/${declaration.id}`,
      );
      expect(frozen.json.snapshotHash).toBe(approvedHash);
      expect(hash(frozen.json.snapshot)).toBe(approvedHash);
    });
    it("tracks deposit independently of generation; rejection preserves evidence and creates a corrective version", async () => {
      const deposit = await admin(
        "POST",
        `/api/apurement/declarations/${declaration.id}/depots`,
        {
          dateDepot: "2026-10-17",
          reference: "SYNTHETIQUE-DEPOT",
          preuveId: proofId,
        },
      );
      expect(deposit.status, deposit.texte).toBe(201);
      expect(deposit.json.statut).toBe("depose");
      const reject = await admin(
        "PATCH",
        `/api/apurement/depots/${deposit.json.id}`,
        {
          expectedVersion: deposit.json.version,
          statut: "rejete",
          preuveId: proofId,
          motif: "Rejet synthétique de test",
        },
      );
      expect(reject.status, reject.texte).toBe(200);
      const versions = await admin(
        "GET",
        `/api/apurement/declarations?societeId=${soc}&annee=2026&trimestre=T4`,
      );
      expect(versions.json).toHaveLength(2);
      expect(versions.json[0].supersedeDeclarationId).toBe(declaration.id);
      expect(versions.json[1].depot).toBe("rejete");
      expect(
        (await admin("GET", `/api/apurement/declarations/${declaration.id}`))
          .json.snapshotHash,
      ).toBe(approvedHash);
    });
    it("deduplicates internal reminders durably and only requests client evidence after explicit Collecte confirmation", async () => {
      const config = await admin("PUT", "/api/apurement/rappels", {
        societeId: soc,
        annee: 2026,
        trimestre: "T4",
        echeance: "2026-01-01",
        cadenceJours: 3,
        actif: true,
      });
      expect(config.status, config.texte).toBe(200);
      await sql.query("BEGIN");
      const first = await sendDueReminders(sql);
      await sql.query("COMMIT");
      expect(first).toBeGreaterThan(0);
      await sql.query("BEGIN");
      const repeat = await sendDueReminders(sql);
      await sql.query("COMMIT");
      expect(repeat).toBe(0);
      expect(
        (
          await sql.query(
            "select count(*)::int n from notifications n join employes e on e.id::text=n.user_key where n.type='apurement' and e.role='societe_employe'",
          )
        ).rows[0].n,
      ).toBe(0);
      const missing = (
        await admin("POST", "/api/apurement/pieces-manquantes", {
          societeId: soc,
          parentType: "facture",
          parentId: invoice.id,
          libelle: "Rappel strictement interne avec montant confidentiel 9999",
        })
      ).json;
      const collecte = (
        await sql.query(
          "select id from collectes where societe_id=$1 limit 1",
          [soc],
        )
      ).rows[0];
      const ask = await admin(
        "POST",
        `/api/apurement/pieces-manquantes/${missing.id}/demander-collecte`,
        { collecteId: collecte.id, confirmer: true },
      );
      expect(ask.status, ask.texte).toBe(200);
      const neutral = (
        await sql.query(
          "select texte from collecte_demandes_pieces where id=$1",
          [ask.json.demandeId],
        )
      ).rows[0].texte;
      expect(neutral).not.toMatch(/Apurement|TVA|9999/);
      const repeated = await admin(
        "POST",
        `/api/apurement/pieces-manquantes/${missing.id}/demander-collecte`,
        { collecteId: collecte.id, confirmer: true },
      );
      expect(repeated.json).toEqual(ask.json);
    });
    it("requires explicit confirmation for a single quantity-one TND line and keeps all line amounts consistent", async () => {
      const f = await create("factures", {
        bcId: bc.id,
        fournisseurId: supplier.id,
        numeroFacture: "TND-SAFE",
        dateFacture: "2026-08-18",
        datePrecision: "day",
        montantHtMillimes: "1000000",
        tauxTvaBps: 1900,
        annee: 2026,
        trimestre: "T3",
      });
      const m = (
        await admin("POST", "/api/stock/mouvements", {
          societeId: soc,
          fournisseur: supplier.raisonSociale,
          achatNumFacture: "TND-SAFE",
          achatDate: "2026-08-18",
          achatDevise: "TND",
          achatCours: 1,
          achatLignes: [
            {
              designation: "Ligne inchangée",
              quantite: 1,
              prixUnitaire: 1000,
              montantDevise: 1000,
              montantTnd: 1000,
            },
          ],
        })
      ).json;
      const source = (await admin("GET", `/api/apurement/stock/${m.id}`)).json;
      const linked = await admin(
        "POST",
        `/api/apurement/factures/${f.id}/lier-stock`,
        {
          expectedVersion: f.version,
          stockId: m.id,
          stockHash: source.hash,
          resolution: "stock",
          confirmer: true,
        },
      );
      expect(linked.status, linked.texte).toBe(200);
      const body = {
        expectedVersion: linked.json.version,
        montantHtMillimes: "1250123",
      };
      expect(
        (await admin("PATCH", `/api/apurement/factures/${f.id}`, body)).status,
      ).toBe(409);
      const confirmed = await admin(
        "PATCH",
        `/api/apurement/factures/${f.id}`,
        { ...body, confirmerMontantStock: true },
      );
      expect(confirmed.status, confirmed.texte).toBe(200);
      expect(confirmed.json.tvaSuspendueMillimes).toBe("237523");
      const line = (
        await sql.query(
          "select designation,quantite,prix_unitaire,montant_devise,montant_tnd from stock_lignes where mouvement_id=$1",
          [m.id],
        )
      ).rows[0];
      expect(line).toEqual({
        designation: "Ligne inchangée",
        quantite: "1",
        prix_unitaire: "1250.123",
        montant_devise: "1250.123",
        montant_tnd: "1250.123",
      });
    });
    it("enters an entire purchase once from one form without silently verifying its new supplier", async () => {
      const body = {
        societeId: soc,
        requestId: "00000000-0000-4000-8000-000000000101",
        fournisseur: {
          raisonSociale: "SAISIE UNIQUE SYNTHETIQUE",
          matriculeFiscalRaw: "1111111ABC000",
        },
        bc: {
          numero: "000901",
          dateBc: "2025-01-01",
          autorisation: { numero: "AUT-SAISIE-UNIQUE" },
        },
        facture: {
          numeroFacture: "FAC-SAISIE-UNIQUE",
          dateFacture: "2025-01-15",
          datePrecision: "day",
          montantHtMillimes: "1234567",
          tauxTvaBps: 1900,
          annee: 2025,
          trimestre: "T1",
        },
      };
      const first = await admin("POST", "/api/apurement/achats", body);
      expect(first.status, first.texte).toBe(201);
      expect(first.json).toMatchObject({
        montantHtMillimes: "1234567",
        tvaSuspendueMillimes: "234568",
      });
      const repeated = await admin("POST", "/api/apurement/achats", body);
      expect(repeated.status).toBe(201);
      expect(repeated.json.id).toBe(first.json.id);
      expect(
        (
          await sql.query(
            "select count(*)::int n from apurement_factures where numero_facture='FAC-SAISIE-UNIQUE'",
          )
        ).rows[0].n,
      ).toBe(1);
      expect(
        (
          await sql.query(
            "select matricule_fiscal_normalise from apurement_fournisseurs where id=$1",
            [first.json.fournisseurId],
          )
        ).rows[0].matricule_fiscal_normalise,
      ).toBeNull();
      expect(
        (
          await admin("POST", "/api/apurement/achats", {
            ...body,
            facture: { ...body.facture, montantHtMillimes: "2000000" },
          })
        ).status,
      ).toBe(409);
    });
    it("rolls back all new purchase references on invalid money and keeps existing role and tenant guards", async () => {
      const before = (
        await sql.query(
          "select (select count(*) from apurement_factures)::int f,(select count(*) from apurement_bons_commande)::int b,(select count(*) from apurement_autorisations)::int a,(select count(*) from apurement_fournisseurs)::int s,(select count(*) from apurement_audit)::int audit",
        )
      ).rows[0];
      const body = {
        societeId: soc,
        requestId: "00000000-0000-4000-8000-000000000102",
        fournisseur: { raisonSociale: "ROLLBACK SYNTHETIQUE" },
        bc: {
          numero: "000902",
          dateBc: "2025-01-01",
          autorisation: { numero: "ROLLBACK AUT" },
        },
        facture: {
          numeroFacture: "ROLLBACK FAC",
          montantHtMillimes: "-1",
          tauxTvaBps: 1900,
          annee: 2025,
          trimestre: "T1",
        },
      };
      expect((await admin("POST", "/api/apurement/achats", body)).status).toBe(
        400,
      );
      expect(
        (
          await sql.query(
            "select (select count(*) from apurement_factures)::int f,(select count(*) from apurement_bons_commande)::int b,(select count(*) from apurement_autorisations)::int a,(select count(*) from apurement_fournisseurs)::int s,(select count(*) from apurement_audit)::int audit",
          )
        ).rows[0],
      ).toEqual(before);
      expect((await client("POST", "/api/apurement/achats", body)).status).toBe(
        403,
      );
      expect(
        (
          await collab("POST", "/api/apurement/achats", {
            ...body,
            societeId: other,
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await admin("POST", "/api/apurement/achats", {
            ...body,
            societeId: other,
            fournisseur: supplier.id,
            bc: bc.id,
            facture: { ...body.facture, montantHtMillimes: "1000" },
          })
        ).status,
      ).toBe(422);
    });
    it("paginates 10000 synthetic invoices and bounded controls without leaking another company", async () => {
      const supplierPerf = await create("fournisseurs", {
        societeId: other,
        raisonSociale: "PERFORMANCE SYNTHETIQUE",
        matriculeFiscalNormalise: "9999999ABC000",
      });
      const authorPerf = await create("autorisations", {
        societeId: other,
        numero: "PERF-AUT",
      });
      const bcPerf = await create("bcs", {
        societeId: other,
        numero: "999999",
        autorisationId: authorPerf.id,
        fournisseurId: supplierPerf.id,
        dateBc: "2027-01-01",
      });
      await sql.query(
        `insert into apurement_factures(societe_id,bc_id,fournisseur_id,numero_facture,date_facture,date_precision,
      montant_ht_millimes,taux_tva_bps,tva_calculee_millimes,tva_suspendue_millimes,tva_mode,annee,trimestre,created_by)
      select $1,$2,$3,'PERF-'||g,'2027-01-15'::date,'day',1000,1900,190,190,'auto',2027,'T1','test' from generate_series(1,10000)g`,
        [other, bcPerf.id, supplierPerf.id],
      );
      const start = Date.now();
      const controls = await admin(
        "GET",
        `/api/apurement/controles?societeId=${other}&annee=2027&trimestre=T1&size=25`,
      );
      expect(controls.status, controls.texte).toBe(200);
      expect(controls.json.controls).toHaveLength(25);
      expect(controls.json.total).toBe(30000);
      expect(controls.json.totals.ht).toBe("10000000");
      expect(controls.json.rows).toBeUndefined();
      const page = await admin(
        "GET",
        `/api/apurement/factures?societeId=${other}&annee=2027&trimestre=T1&page=400&size=25`,
      );
      expect(page.json.items).toHaveLength(25);
      expect(page.json.total).toBe(10000);
      expect(page.json.hasMore).toBe(false);
      expect(
        (
          await collab(
            "GET",
            `/api/apurement/controles?societeId=${other}&annee=2027&trimestre=T1`,
          )
        ).status,
      ).toBe(403);
      console.info(
        `[apurement performance] 10000 factures, contrôles paginés et dernière page : ${Date.now() - start} ms`,
      );
    });
    it("replays migrations with frozen declarations and populated domain tables without altering bytes", async () => {
      const count = (
        await sql.query("select count(*)::int n from apurement_factures")
      ).rows[0].n;
      const schema = readFileSync(
        new URL("../apurement/schema.sql", import.meta.url),
        "utf8",
      );
      await sql.query(schema);
      await sql.query(schema);
      expect(
        (await sql.query("select count(*)::int n from apurement_factures"))
          .rows[0].n,
      ).toBe(count);
      expect(
        (await admin("GET", `/api/apurement/declarations/${declaration.id}`))
          .json.snapshotHash,
      ).toBe(approvedHash);
    });
    it.skipIf(!process.env.PG_BIN)(
      "restores an actual pg_dump archive into a new disposable database and boots with identical frozen evidence",
      async () => {
        const folder = await mkdtemp(join(tmpdir(), "apurement-restore-"));
        let restored, restoreSql, restoreServer;
        try {
          restored = await creerBaseJetable();
          const file = join(folder, "synthetic.dump"),
            run = promisify(execFile);
          const executable = (name) =>
            join(
              process.env.PG_BIN,
              process.platform === "win32" ? `${name}.exe` : name,
            );
          await run(executable("pg_dump"), [
            "--format=custom",
            "--no-owner",
            "--no-privileges",
            `--file=${file}`,
            `--dbname=${base.url}`,
          ]);
          await run(executable("pg_restore"), [
            "--clean",
            "--if-exists",
            "--no-owner",
            "--no-privileges",
            `--dbname=${restored.url}`,
            file,
          ]);
          restoreSql = await restored.client();
          expect(
            (
              await restoreSql.query(
                "select snapshot_hash from apurement_declarations where id=$1",
                [declaration.id],
              )
            ).rows[0].snapshot_hash,
          ).toBe(approvedHash);
          const exports = (
            await sql.query(
              "select id,hash,contenu from apurement_exports where declaration_id=$1",
              [declaration.id],
            )
          ).rows;
          for (const source of exports) {
            const target = (
              await restoreSql.query(
                "select contenu from apurement_exports where id=$1",
                [source.id],
              )
            ).rows[0];
            expect(hash(target.contenu)).toBe(source.hash);
          }
          const pieces = (
            await restoreSql.query("select hash,contenu from apurement_preuves")
          ).rows;
          for (const piece of pieces)
            expect(hash(piece.contenu)).toBe(piece.hash);
          restoreServer = await demarrerServeur(restored.url);
          const restoredAdmin = await connecterAdmin(restoreServer.base);
          const response = await restoredAdmin(
            "GET",
            `/api/apurement/declarations/${declaration.id}`,
          );
          expect(response.status, response.texte).toBe(200);
          expect(hash(response.json.snapshot)).toBe(approvedHash);
        } finally {
          await restoreSql?.end();
          await restoreServer?.arreter();
          await restored?.supprimer();
          if (
            dirname(resolve(folder)) !== resolve(tmpdir()) ||
            !basename(folder).startsWith("apurement-restore-")
          )
            throw new Error("Dossier de nettoyage hors périmètre");
          await rm(folder, { recursive: true, force: true });
        }
      },
    );
  },
);

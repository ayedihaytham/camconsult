import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import {
  api,
  connecterAdmin,
  creerBaseJetable,
  demarrerServeur,
} from "./helpers.js";

vi.setConfig({ testTimeout: 30000, hookTimeout: 60000 });
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Apurement Structuration documents",
  () => {
    let base,
      server,
      sql,
      admin,
      client,
      soc,
      other,
      context,
      folder,
      imported,
      proof;
    const dataUrl =
      "data:application/pdf;base64," +
      Buffer.from("%PDF-1.4\nSynthetic document\n%%EOF").toString("base64");
    beforeAll(async () => {
      base = await creerBaseJetable();
      server = await demarrerServeur(base.url);
      sql = await base.client();
      admin = await connecterAdmin(server.base);
      soc = (
        await sql.query(
          "insert into societes(raison_sociale,code) values('DOCUMENTS SYNTHETIQUES','DOC') returning id",
        )
      ).rows[0].id;
      other = (
        await sql.query(
          "insert into societes(raison_sociale,code) values('AUTRE SOCIETE','OTH') returning id",
        )
      ).rows[0].id;
      const employee = (
        await sql.query(
          "insert into employes(nom,prenom,identifiant,mot_de_passe,role,societe_id) values('Client','Test','client-documents','','societe_employe',$1) returning id",
          [soc],
        )
      ).rows[0].id;
      client = api(
        server.base,
        jwt.sign(
          { role: "employe", employeId: employee },
          server.env.JWT_SECRET,
        ),
      );
      const supplier = (
        await admin("POST", "/api/apurement/fournisseurs", {
          societeId: soc,
          raisonSociale: "FOURNISSEUR DOCUMENTS",
        })
      ).json;
      const invoice = await admin("POST", "/api/apurement/factures", {
        societeId: soc,
        fournisseurId: supplier.id,
        numeroFacture: "DOC-001",
        dateFacture: "2026-08-01",
        datePrecision: "day",
        montantHtMillimes: "1000000",
        tauxTvaBps: 1900,
        annee: 2026,
        trimestre: "T3",
      });
      expect(invoice.status, invoice.texte).toBe(201);
      context = {
        societeId: soc,
        parentType: "facture",
        parentId: invoice.json.id,
      };
    });
    afterAll(async () => {
      await sql?.end();
      await server?.arreter();
      await base?.supprimer();
    });

    it("creates one scoped cabinet folder and classifies new Apurement uploads there transactionally", async () => {
      const response = await admin(
        "POST",
        "/api/apurement/pieces/dossier",
        context,
      );
      expect(response.status, response.texte).toBe(200);
      folder = response.json;
      expect(folder.chemin).toBe(
        "DOCUMENTS SYNTHETIQUES / Apurement TVA / 2026 / T3 / Factures",
      );
      expect(
        (await admin("POST", "/api/apurement/pieces/dossier", context)).json.id,
      ).toBe(folder.id);
      expect(
        (
          await admin(
            "GET",
            `/api/apurement/pieces/sources?societeId=${soc}&folderId=${folder.id}`,
          )
        ).json,
      ).toEqual([]);
      const upload = await admin("POST", "/api/apurement/pieces", {
        ...context,
        source: "apurement_upload",
        nom: "nouveau.pdf",
        dataUrl,
      });
      expect(upload.status, upload.texte).toBe(201);
      const node = (
        await sql.query("select * from noeuds where id=$1", [
          upload.json.sourceId,
        ])
      ).rows[0];
      expect(node.parent_id).toBe(folder.id);
      expect(node.societe_id).toBe(soc);
      expect(node.cabinet_only).toBe(true);
      expect(node.data_url).toBe(dataUrl);
      const invalid = await admin("POST", "/api/apurement/pieces", {
        ...context,
        source: "apurement_upload",
        nom: "invalide.pdf",
        dataUrl: "data:application/pdf;base64,YmFk",
      });
      expect(invalid.status).toBe(422);
      expect(
        (
          await sql.query(
            "select count(*)::int as n from noeuds where libelle='invalide.pdf'",
          )
        ).rows[0].n,
      ).toBe(0);
    });
    it("discovers documents uploaded directly through Structuration and preserves original paths and frozen evidence", async () => {
      const result = await admin("POST", "/api/noeuds", {
        libelle: "importe-structuration.pdf",
        type: "fichier",
        societeId: soc,
        parentId: folder.id,
        dataUrl,
      });
      expect(result.status, result.texte).toBe(201);
      imported = result.json;
      expect(imported.cabinetOnly).toBe(true);
      const response = await admin(
        "GET",
        `/api/apurement/pieces/sources?societeId=${soc}&folderId=${folder.id}&q=importe`,
      );
      expect(response.status, response.texte).toBe(200);
      expect(response.json).toHaveLength(1);
      expect(response.json[0]).toMatchObject({
        id: imported.id,
        source: "noeud",
        chemin: `${folder.chemin} / importe-structuration.pdf`,
      });
      expect(response.json[0]).not.toHaveProperty("dataUrl");
      const attached = await admin("POST", "/api/apurement/pieces", {
        ...context,
        source: "noeud",
        sourceId: imported.id,
      });
      expect(attached.status, attached.texte).toBe(201);
      proof = attached.json;
      expect(
        (
          await sql.query("select parent_id from noeuds where id=$1", [
            imported.id,
          ])
        ).rows[0].parent_id,
      ).toBe(folder.id);
      const before = await admin(
        "GET",
        `/api/apurement/pieces/${proof.id}/telecharger`,
      );
      await sql.query("delete from noeuds where id=$1", [imported.id]);
      expect(
        (await admin("GET", `/api/apurement/pieces/${proof.id}/telecharger`))
          .texte,
      ).toBe(before.texte);
    });
    it("rejects cross-company paths and sources and blocks company-side access through both Structuration and bootstrap", async () => {
      const foreign = (
        await admin("POST", "/api/noeuds", {
          libelle: "autre.pdf",
          type: "fichier",
          societeId: other,
          dataUrl,
        })
      ).json;
      expect(
        (
          await admin("POST", "/api/apurement/pieces", {
            ...context,
            source: "noeud",
            sourceId: foreign.id,
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await admin(
            "GET",
            `/api/apurement/pieces/sources?societeId=${other}&folderId=${folder.id}`,
          )
        ).status,
      ).toBe(422);
      expect(
        (await client("POST", "/api/apurement/pieces/dossier", context)).status,
      ).toBe(403);
      const internal = (
        await sql.query(
          "select id from noeuds where societe_id=$1 and type='fichier' and cabinet_only limit 1",
          [soc],
        )
      ).rows[0].id;
      expect(
        (await client("GET", `/api/noeuds/${internal}/contenu`)).status,
      ).toBe(403);
      expect(
        (await client("GET", "/api/noeuds")).json.some((n) => n.cabinetOnly),
      ).toBe(false);
      expect(
        (await client("GET", "/api/data/bootstrap")).json.noeuds.some(
          (n) => n.cabinetOnly,
        ),
      ).toBe(false);
      const moved = await admin("PATCH", `/api/noeuds/${internal}`, {
        parentId: null,
      });
      expect(moved.status, moved.texte).toBe(200);
      expect(moved.json.cabinetOnly).toBe(true);
      expect(
        (await client("GET", `/api/noeuds/${internal}/contenu`)).status,
      ).toBe(403);
      const duplicate = await admin(
        "POST",
        `/api/noeuds/${internal}/duplicate`,
      );
      expect(duplicate.status, duplicate.texte).toBe(201);
      expect(duplicate.json[0].cabinetOnly).toBe(true);
      expect(
        (await client("GET", `/api/noeuds/${duplicate.json[0].id}/contenu`))
          .status,
      ).toBe(403);
    });
  },
);

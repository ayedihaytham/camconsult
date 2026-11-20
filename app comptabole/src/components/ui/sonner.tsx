import { Toaster as Sonner } from "sonner";
import "./notifications.css";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Notifications du cabinet : carte à liseré et pastille d'icône par type (voir notifications.css). */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      mobileOffset={{ bottom: 76, left: 12, right: 12 }}
      toastOptions={{
        classNames: {
          toast: "cc-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

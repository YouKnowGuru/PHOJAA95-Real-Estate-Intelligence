import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Home, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center px-4"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted mx-auto mb-6">
          <AlertTriangle className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">404</h1>
        <p className="text-lg text-muted-foreground mt-2">Page not found</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/" className="inline-block mt-6">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            <Home className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}

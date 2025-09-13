import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit2, Settings } from "lucide-react";
import { HomepageEditor } from "./HomepageEditor";
import { SEOSettings } from "./SEOSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdmin } from "@/hooks/useAdmin";

export const AdminEditToggle = () => {
  const { isAdmin, loading } = useAdmin();
  const [open, setOpen] = useState(false);

  if (loading || !isAdmin) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed top-24 right-4 z-50 bg-background/80 backdrop-blur-sm border-primary/50 hover:bg-primary/10"
        >
          <Edit2 className="h-4 w-4 mr-2" />
          Edit Page
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Admin Content Editor</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="homepage" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="homepage">Homepage Content</TabsTrigger>
            <TabsTrigger value="seo">SEO Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="homepage" className="space-y-4">
            <HomepageEditor />
          </TabsContent>
          <TabsContent value="seo" className="space-y-4">
            <SEOSettings />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
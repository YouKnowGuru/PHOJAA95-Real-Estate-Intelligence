import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AppleCard } from "@/components/ui/apple-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SoftwareTabPanel } from "@/components/software-dev";
import { TabSectionHeader } from "../TabSectionHeader";

export default function CategoriesTab({ isAdmin }: { isAdmin: boolean }) {
  const utils = trpc.useUtils();
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const { data: categories } = trpc.architectureCategory.list.useQuery({ includeInactive: isAdmin });

  const createCategory = trpc.architectureCategory.create.useMutation({
    onSuccess: () => {
      toast.success("Category added");
      setNewCategory({ name: "", description: "" });
      utils.architectureCategory.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <SoftwareTabPanel>
      <TabSectionHeader
        title="Architecture Categories"
        description="Residential, commercial, interior, landscape, and other design service categories."
      />

      {isAdmin && (
        <AppleCard className="p-4 mb-6">
          <h3 className="font-semibold mb-3">Add Category</h3>
          <form onSubmit={(e) => { e.preventDefault(); createCategory.mutate(newCategory); }} className="flex flex-wrap gap-3">
            <Input placeholder="Category name" value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} className="flex-1 min-w-[200px]" required />
            <Input placeholder="Description" value={newCategory.description} onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })} className="flex-1 min-w-[200px]" />
            <Button type="submit" disabled={createCategory.isPending}>Add</Button>
          </form>
        </AppleCard>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(categories || []).map((c) => (
          <AppleCard key={c.id} className="p-3">
            <h4 className="font-medium">{c.name}</h4>
            {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
          </AppleCard>
        ))}
      </div>
    </SoftwareTabPanel>
  );
}

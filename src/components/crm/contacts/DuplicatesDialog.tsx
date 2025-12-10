import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Merge, CheckCircle } from "lucide-react";
import { useDuplicateContacts, DuplicateGroup } from "@/hooks/crm/use-duplicate-contacts";
import { useMergeContacts, useBulkMergeAll } from "@/hooks/crm/use-merge-contacts";
import { format } from "date-fns";

interface DuplicatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DuplicatesDialog({ open, onOpenChange }: DuplicatesDialogProps) {
  const { data: duplicates, isLoading } = useDuplicateContacts();
  const mergeContacts = useMergeContacts();
  const bulkMergeAll = useBulkMergeAll();
  
  const [processingGroup, setProcessingGroup] = useState<string | null>(null);

  const handleMergeGroup = async (group: DuplicateGroup) => {
    setProcessingGroup(group.email);
    const [masterId, ...duplicateIds] = group.contact_ids;
    await mergeContacts.mutateAsync({ masterId, duplicateIds });
    setProcessingGroup(null);
  };

  const handleAutoMergeAll = async () => {
    if (!duplicates || duplicates.length === 0) return;
    await bulkMergeAll.mutateAsync();
  };

  const totalDuplicates = duplicates?.reduce((sum, g) => sum + g.duplicate_count - 1, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Manage Duplicate Contacts</DialogTitle>
          <DialogDescription>
            Found {duplicates?.length || 0} duplicate groups ({totalDuplicates} duplicates to remove)
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : duplicates && duplicates.length > 0 ? (
          <>
            <div className="flex gap-2 mb-4">
              <Button
                onClick={handleAutoMergeAll}
                disabled={bulkMergeAll.isPending}
                variant="default"
              >
                {bulkMergeAll.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Merge className="h-4 w-4 mr-2" />
                )}
                Auto-Merge All ({totalDuplicates} duplicates)
              </Button>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {duplicates.map((group) => (
                  <DuplicateGroupCard
                    key={group.email}
                    group={group}
                    onMerge={() => handleMergeGroup(group)}
                    isProcessing={processingGroup === group.email}
                  />
                ))}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium">No duplicates found</p>
            <p className="text-sm text-muted-foreground">Your contact list is clean!</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  onMerge: () => void;
  isProcessing: boolean;
}

function DuplicateGroupCard({ group, onMerge, isProcessing }: DuplicateGroupCardProps) {
  return (
    <div className="border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{group.email}</p>
          <p className="text-sm text-muted-foreground">
            {group.duplicate_count} contacts with this email
          </p>
        </div>
        <Button
          size="sm"
          onClick={onMerge}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Merge className="h-4 w-4 mr-2" />
          )}
          Merge
        </Button>
      </div>

      <div className="grid gap-2">
        {group.contact_ids.map((id, idx) => (
          <div
            key={id}
            className={`text-sm p-2 bg-muted/50 flex items-center justify-between ${
              idx === 0 ? "border-l-2 border-primary" : ""
            }`}
          >
            <div className="flex-1 min-w-0">
              <span className="font-medium">{group.contact_names[idx]}</span>
              {idx === 0 && (
                <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5">
                  Keep
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>{group.contact_types[idx]}</span>
              <span>{group.contact_phones[idx] || "No phone"}</span>
              <span className="text-xs">
                {format(new Date(group.created_dates[idx]), "MMM d, yyyy")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

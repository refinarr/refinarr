"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/client/components/ui/dialog";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { useCreateInstance, useUpdateInstance } from "@/client/hooks/useInstances";
import { toast } from "sonner";
import type { Instance } from "@/shared/types/models";

const schema = z.object({
  type: z.enum(["radarr", "sonarr"]),
  name: z.string().min(1),
  url: z.string().url(),
  apiKey: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Instance | null;
}

export function AddInstanceDialog({ open, onClose, editing }: Props) {
  const create = useCreateInstance();
  const update = useUpdateInstance();
  const [selectedType, setSelectedType] = useState<"radarr" | "sonarr">(editing?.type ?? "radarr");

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editing ?? { type: "radarr", name: "", url: "", apiKey: "" },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data });
        toast.success("Instance updated");
      } else {
        await create.mutateAsync(data);
        toast.success("Instance added");
      }
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save instance");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Instance" : "Add Instance"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select
              value={selectedType}
              onValueChange={(v) => {
                if (v) {
                  const t = v as "radarr" | "sonarr";
                  setSelectedType(t);
                  setValue("type", t);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue>{selectedType === "radarr" ? "Radarr" : "Sonarr"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="radarr">Radarr</SelectItem>
                <SelectItem value="sonarr">Sonarr</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input {...register("name")} placeholder="My Radarr" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>URL</Label>
            <Input {...register("url")} placeholder="http://localhost:7878" />
            {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>API Key</Label>
            <Input {...register("apiKey")} type="password" placeholder="••••••••" />
            {errors.apiKey && <p className="text-xs text-destructive">{errors.apiKey.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

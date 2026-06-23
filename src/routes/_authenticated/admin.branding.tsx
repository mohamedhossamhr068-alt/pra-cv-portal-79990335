import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMeQuery } from "@/lib/me.client";
import { updateBranding } from "@/lib/tenant.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/branding")({
  component: Branding,
});

function Branding() {
  const { t } = useTranslation();
  const me = useMeQuery();
  const qc = useQueryClient();
  const fn = useServerFn(updateBranding);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [color, setColor] = useState("#4f46e5");

  useEffect(() => {
    if (me.data?.tenant) {
      setName(me.data.tenant.name ?? "");
      setLogo(me.data.tenant.logo_url ?? "");
      setColor(me.data.tenant.primary_color ?? "#4f46e5");
    }
  }, [me.data?.tenant]);

  const mut = useMutation({
    mutationFn: () => fn({ data: { name, logo_url: logo, primary_color: color } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success(t("settings.saved"));
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("admin.brandingTitle")}</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Brand</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div><Label>{t("admin.companyName")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>{t("admin.logoUrl")}</Label><Input placeholder="https://…/logo.png" value={logo} onChange={(e) => setLogo(e.target.value)} /></div>
          <div>
            <Label>{t("admin.primaryColor")}</Label>
            <div className="flex items-center gap-3">
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 p-1" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{t("settings.save")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

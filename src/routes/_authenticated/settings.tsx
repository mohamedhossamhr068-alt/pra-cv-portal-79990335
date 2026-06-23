import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMeQuery } from "@/lib/me.hooks";
import { updateProfileName, updateLocale } from "@/lib/tenant.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { setLocale } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

function Settings() {
  const { t, i18n } = useTranslation();
  const me = useMeQuery();
  const qc = useQueryClient();
  const updName = useServerFn(updateProfileName);
  const updLoc = useServerFn(updateLocale);
  const [name, setName] = useState("");
  useEffect(() => {
    setName(me.data?.profile?.full_name ?? "");
  }, [me.data?.profile?.full_name]);

  const saveMut = useMutation({
    mutationFn: async () => {
      await updName({ data: { full_name: name } });
      await updLoc({ data: { locale: (i18n.language === "ar" ? "ar" : "en") as "en" | "ar" } });
    },
    onSuccess: () => {
      toast.success(t("settings.saved"));
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("settings.title")}</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("settings.profile")}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label>{t("settings.fullName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>{t("settings.language")}</Label>
            <div className="mt-1 flex gap-2">
              <Button variant={i18n.language === "en" ? "default" : "outline"} size="sm" onClick={() => setLocale("en")}>English</Button>
              <Button variant={i18n.language === "ar" ? "default" : "outline"} size="sm" onClick={() => setLocale("ar")}>العربية</Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{t("settings.save")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

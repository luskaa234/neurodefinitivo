"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { deleteInternalNotification, listInternalNotifications, markInternalNotificationRead, subscribeToInternalNotifications, type InternalNotification } from "@/lib/notifications";
import { formatDateTimeBR } from "@/utils/date";

export function NotificationCenter() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InternalNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listInternalNotifications(user?.id));
    } catch (error: any) {
      toast.error(error?.message || "Erro ao carregar notificações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  useEffect(() => subscribeToInternalNotifications(user?.id, load), [user?.id]);

  const unread = useMemo(() => rows.filter((item) => !item.read_at).length, [rows]);

  const markRead = async (id: string) => {
    await markInternalNotificationRead(id);
    await load();
  };

  const remove = async (id: string) => {
    await deleteInternalNotification(id);
    await load();
  };

  return (
    <div className="space-y-6 px-2 sm:px-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Central de Notificações</h1>
          <p className="text-sm text-slate-600">Eventos internos sincronizados entre dispositivos.</p>
        </div>
        <Badge variant={unread ? "default" : "secondary"} className="w-fit">
          {unread} não lida(s)
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações
          </CardTitle>
          <CardDescription>{loading ? "Carregando..." : `${rows.length} registro(s)`}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant={item.read_at ? "secondary" : "default"}>
                        {item.read_at ? "Lida" : "Nova"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{item.message}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell>{formatDateTimeBR(item.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-2">
                        {!item.read_at && (
                          <Button variant="outline" size="sm" onClick={() => markRead(item.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => remove(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                      Nenhuma notificação.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


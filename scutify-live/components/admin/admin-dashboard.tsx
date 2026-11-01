"use client";

import { ExternalLink, LogOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLiveChat } from "@/hooks/use-live-chat";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePolling } from "@/hooks/use-polling";
import { END_OF_LIVE_MINUTES, MESSAGE_COLUMNS } from "@/lib/chat/constants";
import { parseChatError } from "@/lib/chat/errors";
import type { ChatMessage, ChatSettings, Profile } from "@/lib/chat/types";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { ConfirmDialog, type ConfirmRequest } from "./confirm-dialog";
import { ControlsBar } from "./controls-bar";
import { type BlockedKeyword, KeywordsPanel } from "./keywords-panel";
import { LiveFeed } from "./live-feed";
import { MessageActions } from "./message-actions";
import { OfferPanel } from "./offer-panel";
import { PinPanel } from "./pin-panel";
import { RelancePanel, type RelancePreset } from "./relance-panel";
import { ShadowPanel } from "./shadow-panel";
import { type ModeratedUser, UsersPanel } from "./users-panel";

type Tab = "direct" | "relance" | "pin" | "offer" | "shadow" | "users" | "keywords";
type PanelTab = Exclude<Tab, "direct">;

const SETTINGS_COLUMNS =
  "chat_enabled,slow_mode_seconds,links_allowed,pinned_message,pinned_url,pinned_label,custom_html_updated_at,quick_replies,quick_replies_until,updated_at" as const;

function muteLabel(minutes: number): string {
  if (minutes >= END_OF_LIVE_MINUTES) return "jusqu'à la fin du live";
  if (minutes >= 60) return `pendant ${minutes / 60} h`;
  return `pendant ${minutes} min`;
}

export function AdminDashboard({ profile }: { profile: Profile }) {
  const supabase = getSupabase();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [tab, setTab] = useState<Tab>("direct");
  const [panelTab, setPanelTab] = useState<PanelTab>("relance");
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [usersVersion, setUsersVersion] = useState(0);

  const onUserMuted = useCallback(() => setUsersVersion((v) => v + 1), []);
  const chat = useLiveChat({ mode: "admin", onUserMuted });
  const { removeMessages, setSettings, setCustomHtml } = chat;

  // ------------------------------------------------------------ données ---

  const shadow = usePolling(async (): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("status", "shadow")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  }, 10_000);

  const users = usePolling(
    async (): Promise<ModeratedUser[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,pseudo,email,muted_until,banned")
        .or(`banned.eq.true,muted_until.gt.${new Date().toISOString()}`)
        .order("pseudo");
      if (error) throw error;
      return data ?? [];
    },
    20_000,
    usersVersion,
  );

  const { setData: setShadow, refresh: refreshShadow } = shadow;

  const keywords = usePolling(async (): Promise<BlockedKeyword[]> => {
    const { data, error } = await supabase.from("blocked_keywords").select("id,keyword").order("keyword");
    if (error) throw error;
    return data ?? [];
  }, 60_000);

  // ------------------------------------------------------------ actions ---

  const fail = useCallback((error: unknown) => {
    toast.error(parseChatError(error).message);
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<ChatSettings> & { custom_html?: string | null }): Promise<boolean> => {
      setSavingSettings(true);
      const { data, error } = await supabase
        .from("chat_settings")
        .update(patch)
        .eq("id", 1)
        .select(SETTINGS_COLUMNS)
        .single();
      setSavingSettings(false);
      if (error) {
        fail(error);
        return false;
      }
      setSettings(data);
      return true;
    },
    [supabase, setSettings, fail],
  );

  const deleteMessage = useCallback(
    async (message: ChatMessage) => {
      const { error } = await supabase.rpc("admin_set_message_status", { message_id: message.id, status: "deleted" });
      if (error) return fail(error);
      removeMessages([message.id]);
      setShadow((list) => list?.filter((m) => m.id !== message.id) ?? list);
      toast.success("Message supprimé");
    },
    [supabase, removeMessages, setShadow, fail],
  );

  const approveMessage = useCallback(
    async (message: ChatMessage) => {
      const { error } = await supabase.rpc("admin_set_message_status", { message_id: message.id, status: "visible" });
      if (error) return fail(error);
      setShadow((list) => list?.filter((m) => m.id !== message.id) ?? list);
      toast.success(`Message de ${message.pseudo} rendu visible`);
    },
    [supabase, setShadow, fail],
  );

  const muteUser = useCallback(
    async (userId: string, pseudo: string, minutes: number | null) => {
      const { error } = await supabase.rpc("admin_mute_user", { user_id: userId, minutes });
      if (error) return fail(error);
      setUsersVersion((v) => v + 1);
      toast.success(minutes ? `${pseudo} ne peut plus écrire ${muteLabel(minutes)}` : `${pseudo} peut de nouveau écrire`);
    },
    [supabase, fail],
  );

  const banUser = useCallback(
    async (userId: string, pseudo: string, banned: boolean) => {
      const { error } = await supabase.rpc("admin_ban_user", { user_id: userId, banned });
      if (error) return fail(error);
      setUsersVersion((v) => v + 1);
      if (banned) void refreshShadow();
      toast.success(banned ? `${pseudo} est banni du chat` : `${pseudo} n'est plus banni`);
    },
    [supabase, refreshShadow, fail],
  );

  const moderation = {
    onDelete: (message: ChatMessage) => void deleteMessage(message),
    onMute: (message: ChatMessage, minutes: number) => void muteUser(message.user_id, message.pseudo, minutes),
    onBan: (message: ChatMessage) =>
      setConfirm({
        title: `Bannir ${message.pseudo} ?`,
        description:
          "Cette personne ne pourra plus écrire dans le chat et tous ses messages seront masqués. Tu pourras annuler depuis l'onglet Utilisateurs.",
        confirmLabel: "Bannir",
        destructive: true,
        onConfirm: () => banUser(message.user_id, message.pseudo, true),
      }),
  };

  // Callback stable : sans lui, chaque message reçu re-rendrait les 200
  // messages du fil. Les handlers à jour sont lus via une ref.
  const moderationRef = useRef(moderation);
  useEffect(() => {
    moderationRef.current = moderation;
  });
  const renderActions = useCallback(
    (message: ChatMessage) => (
      <MessageActions
        message={message}
        onDelete={(m) => moderationRef.current.onDelete(m)}
        onMute={(m, minutes) => moderationRef.current.onMute(m, minutes)}
        onBan={(m) => moderationRef.current.onBan(m)}
      />
    ),
    [],
  );

  const launchRelance = async (preset: RelancePreset): Promise<boolean> => {
    const replies = preset.replies.map((r) => r.trim()).filter(Boolean);
    if (replies.length === 0) {
      toast.error("Ajoute au moins un bouton de réponse.");
      return false;
    }
    if (preset.message.trim()) {
      const sent = await chat.sendMessage(preset.message.trim());
      if (!sent.ok) {
        toast.error(sent.error);
        return false;
      }
    }
    const { data: until, error } = await supabase.rpc("admin_set_quick_replies", {
      replies,
      seconds: preset.seconds,
    });
    if (error) {
      fail(error);
      return false;
    }
    setSettings((prev) => (prev ? { ...prev, quick_replies: replies, quick_replies_until: until } : prev));
    toast.success(`Relance lancée pour ${preset.seconds} s 🔥`);
    return true;
  };

  const stopRelance = async (): Promise<boolean> => {
    const { error } = await supabase.rpc("admin_set_quick_replies", { replies: [], seconds: 0 });
    if (error) {
      fail(error);
      return false;
    }
    setSettings((prev) => (prev ? { ...prev, quick_replies: null, quick_replies_until: null } : prev));
    toast.success("Relance arrêtée");
    return true;
  };

  const clearChat = () =>
    setConfirm({
      title: "Vider le chat ?",
      description:
        "Tous les messages (visibles et bloqués) disparaissent immédiatement pour tous les spectateurs. Cette action est faite pour stopper une attaque de spam.",
      confirmLabel: "Vider le chat",
      destructive: true,
      onConfirm: async () => {
        const { data, error } = await supabase.rpc("admin_clear_chat");
        if (error) return fail(error);
        setShadow([]);
        toast.success(`Chat vidé (${data ?? 0} message${(data ?? 0) > 1 ? "s" : ""} masqué${(data ?? 0) > 1 ? "s" : ""})`);
      },
    });

  const addKeyword = async (keyword: string): Promise<boolean> => {
    const { error } = await supabase.from("blocked_keywords").insert({ keyword });
    if (error) {
      toast.error(error.code === "23505" ? "Ce mot-clé est déjà bloqué." : parseChatError(error).message);
      return false;
    }
    void keywords.refresh();
    toast.success(`« ${keyword} » ajouté aux mots-clés bloqués`);
    return true;
  };

  const removeKeyword = async (keyword: BlockedKeyword) => {
    const { error } = await supabase.from("blocked_keywords").delete().eq("id", keyword.id);
    if (error) return fail(error);
    keywords.setData((list) => list?.filter((k) => k.id !== keyword.id) ?? list);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // ---------------------------------------------------------------- vue ---

  const shadowCount = shadow.data?.length ?? 0;
  const usersCount = users.data?.length ?? 0;
  const activePanel: PanelTab = tab === "direct" ? panelTab : tab;

  const onTabChange = (value: string) => {
    const next = value as Tab;
    setTab(next);
    if (next !== "direct") setPanelTab(next);
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-brand-navy text-white shadow">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-6">
          <p className="text-lg font-extrabold tracking-tight">
            Scutify <span className="text-brand-sky">Live</span>
            <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">
              Admin
            </span>
          </p>
          <span className="hidden truncate text-sm text-white/70 sm:inline">Connecté : {profile.pseudo}</span>
          <div className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">
              <a href="/live" target="_blank" rel="noopener noreferrer">
                <ExternalLink /> <span className="hidden sm:inline">Voir le live</span>
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-white hover:bg-white/10 hover:text-white"
              aria-label="Se déconnecter"
            >
              <LogOut /> <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-3 p-3 sm:space-y-4 sm:p-6">
        {chat.settings ? (
          <ControlsBar settings={chat.settings} saving={savingSettings} onUpdate={updateSettings} onClear={clearChat} />
        ) : (
          <div className="h-[68px] animate-pulse rounded-xl bg-white" />
        )}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:items-start">
          <div className={cn(tab === "direct" ? "block" : "hidden", "min-w-0 lg:block")}>
            <Tabs value={isDesktop ? activePanel : tab} onValueChange={onTabChange} className="mb-3 lg:hidden">
              <AdminTabsList shadowCount={shadowCount} usersCount={usersCount} withDirect />
            </Tabs>
            <LiveFeed chat={chat} renderActions={renderActions} />
          </div>

          <div className={cn(tab === "direct" ? "hidden" : "block", "min-w-0 space-y-3 lg:block")}>
            <Tabs value={isDesktop ? activePanel : tab} onValueChange={onTabChange}>
              <AdminTabsList shadowCount={shadowCount} usersCount={usersCount} withDirect={!isDesktop} />
            </Tabs>

            {activePanel === "relance" && chat.settings && (
              <RelancePanel settings={chat.settings} onLaunch={launchRelance} onStop={stopRelance} />
            )}
            {activePanel === "offer" && (
              <OfferPanel
                html={chat.customHtml}
                saving={savingSettings}
                onSave={async (html) => {
                  const ok = await updateSettings({ custom_html: html });
                  if (ok) {
                    setCustomHtml(html);
                    toast.success(html ? "Bloc publié sous la vidéo" : "Bloc retiré");
                  }
                  return ok;
                }}
              />
            )}
            {activePanel === "pin" && chat.settings && (
              <PinPanel settings={chat.settings} saving={savingSettings} onSave={updateSettings} />
            )}
            {activePanel === "shadow" && (
              <ShadowPanel
                messages={shadow.data}
                loading={shadow.loading}
                onRefresh={() => void shadow.refresh()}
                onApprove={(m) => void approveMessage(m)}
                {...moderation}
              />
            )}
            {activePanel === "users" && (
              <UsersPanel
                users={users.data}
                loading={users.loading}
                onRefresh={() => void users.refresh()}
                onUnmute={(u) => void muteUser(u.id, u.pseudo, null)}
                onUnban={(u) => void banUser(u.id, u.pseudo, false)}
              />
            )}
            {activePanel === "keywords" && (
              <KeywordsPanel
                keywords={keywords.data}
                loading={keywords.loading}
                onAdd={addKeyword}
                onRemove={(k) => void removeKeyword(k)}
              />
            )}
          </div>
        </div>
      </main>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function AdminTabsList({
  shadowCount,
  usersCount,
  withDirect,
}: {
  shadowCount: number;
  usersCount: number;
  withDirect: boolean;
}) {
  return (
    <TabsList className="scrollbar-thin h-auto w-full justify-start overflow-x-auto">
      {withDirect && <TabsTrigger value="direct">Direct</TabsTrigger>}
      <TabsTrigger value="relance">Relances</TabsTrigger>
      <TabsTrigger value="pin">Épingle</TabsTrigger>
      <TabsTrigger value="offer">Offre</TabsTrigger>
      <TabsTrigger value="shadow">
        Bloqués
        {shadowCount > 0 && <Counter value={shadowCount} highlight />}
      </TabsTrigger>
      <TabsTrigger value="users">
        Utilisateurs
        {usersCount > 0 && <Counter value={usersCount} />}
      </TabsTrigger>
      <TabsTrigger value="keywords">Mots-clés</TabsTrigger>
    </TabsList>
  );
}

function Counter({ value, highlight }: { value: number; highlight?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
        highlight ? "bg-destructive text-white" : "bg-brand-navy text-white",
      )}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

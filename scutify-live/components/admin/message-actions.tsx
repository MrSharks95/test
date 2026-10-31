"use client";

import { Ban, MoreVertical, Trash2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MUTE_OPTIONS } from "@/lib/chat/constants";
import type { ChatMessage } from "@/lib/chat/types";

export type ModerationHandlers = {
  onDelete: (message: ChatMessage) => void;
  onMute: (message: ChatMessage, minutes: number) => void;
  onBan: (message: ChatMessage) => void;
};

export function MessageActions({ message, onDelete, onMute, onBan }: { message: ChatMessage } & ModerationHandlers) {
  return (
    // modal={false} : évite le blocage du focus quand une boîte de
    // confirmation s'ouvre depuis le menu.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="-my-1 shrink-0 text-muted-foreground"
          aria-label={`Modérer le message de ${message.pseudo}`}
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate normal-case">{message.pseudo}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onDelete(message)}>
          <Trash2 /> Supprimer le message
        </DropdownMenuItem>
        {!message.is_team && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Muter l&apos;auteur</DropdownMenuLabel>
            {MUTE_OPTIONS.map((option) => (
              <DropdownMenuItem key={option.minutes} onSelect={() => onMute(message, option.minutes)}>
                <VolumeX /> {option.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => onBan(message)}>
              <Ban /> Bannir l&apos;auteur
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

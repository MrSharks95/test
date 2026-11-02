-- =============================================================================
-- Scutify Live — offre et épingle prêtes à l'avance, affichées sur interrupteur
--
-- Le contenu (bloc HTML « Offre », message épinglé) est enregistré à
-- l'avance et reste modifiable ; il n'apparaît chez les spectateurs que
-- lorsque l'équipe active l'interrupteur correspondant (instantané : un seul
-- settings_updated, le HTML est déjà chargé par les spectateurs).
-- =============================================================================

alter table public.chat_settings
  add column custom_html_enabled boolean not null default false,
  add column pinned_enabled boolean not null default false;

create or replace function private.settings_payload(s public.chat_settings)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'chat_enabled', s.chat_enabled,
    'slow_mode_seconds', s.slow_mode_seconds,
    'links_allowed', s.links_allowed,
    'pinned_message', s.pinned_message,
    'pinned_url', s.pinned_url,
    'pinned_label', s.pinned_label,
    'pinned_enabled', s.pinned_enabled,
    'custom_html_updated_at', s.custom_html_updated_at,
    'custom_html_enabled', s.custom_html_enabled,
    'quick_replies', s.quick_replies,
    'quick_replies_until', s.quick_replies_until,
    'reactions_enabled', s.reactions_enabled,
    'live_open', s.live_open,
    'live_starts_at', s.live_starts_at,
    'updated_at', s.updated_at
  );
$$;

-- Admins seuls (policy « chat_settings: admin update »).
grant update (custom_html_enabled, pinned_enabled) on public.chat_settings to authenticated;

-- Contenu du live du 02/11/2026, prêt mais masqué (interrupteurs à false).
update public.chat_settings
   set pinned_message = 'Rejoins Déclic Scutify ce soir',
       pinned_label = '👉 Je profite de l’offre',
       pinned_url = 'https://www.scutify-club.com/offers/ym7bNY2K/checkout',
       pinned_enabled = false,
       custom_html_enabled = false,
       custom_html = btrim($offer$
<div style="width: 100%; max-width: 100%; margin: 0; padding: 0; font-family: 'Montserrat', Arial, Helvetica, sans-serif; color: #333333; line-height: 1.5; box-sizing: border-box;">

  <!-- HERO + CTA -->
  <div style="background-color: #003366; border-radius: 18px; padding: 28px 22px; text-align: center; margin: 0 0 14px 0; box-shadow: 0 12px 30px rgba(0,51,102,0.3); border: 3px solid #66ccff;">
    <span style="display: inline-block; background-color: #66ccff; color: #003366; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding: 6px 14px; border-radius: 50px; margin: 0 0 12px 0;">🔴 Offre réservée aux participants du live</span>
    <p style="font-size: 26px; font-weight: 800; color: #ffffff; line-height: 1.25; margin: 0 0 8px 0;">Rejoins la formation <span style="color: #66ccff;">Déclic Scutify</span></p>
    <p style="font-size: 15px; color: #cce9ff; margin: 0 0 18px 0;">La formation complète + 5 bonus + 2 séances de coaching offertes avant minuit.</p>

    <p style="font-size: 16px; color: #cce9ff; margin: 0 0 2px 0;">Valeur totale : <span style="text-decoration: line-through;">5&nbsp;153&nbsp;€</span></p>
    <p style="font-size: 44px; font-weight: 800; color: #66ccff; line-height: 1.1; margin: 0 0 4px 0;">997&nbsp;€</p>
    <p style="font-size: 15px; font-weight: 700; color: #ffffff; margin: 0 0 20px 0;">💳 ou payable en 3 fois</p>

    <a href="https://www.scutify-club.com/offers/ym7bNY2K/checkout" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #66ccff; color: #003366; font-size: 19px; font-weight: 800; text-decoration: none; padding: 18px 40px; border-radius: 50px; border: 3px solid #ffffff; box-shadow: 0 8px 24px rgba(102,204,255,0.55);">🚀 Je rejoins la formation</a>
    <p style="font-size: 13px; font-weight: 700; color: #66ccff; margin: 14px 0 0 0;">⏳ Fin de l'offre · ce soir à minuit, heure de Paris</p>
  </div>

  <!-- COACHING AVANT MINUIT -->
  <div style="background-color: #66ccff; border-radius: 16px; padding: 16px 20px; text-align: center; margin: 0 0 14px 0;">
    <p style="font-size: 12px; font-weight: 800; color: #003366; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">⏰ Bonus si tu passes à l'action avant minuit</p>
    <p style="font-size: 17px; font-weight: 800; color: #003366; margin: 0 0 2px 0;">2 séances de coaching individuelles</p>
    <p style="font-size: 14px; color: #003366; margin: 0;">Avec Karine, Richard, Mounir ou un expert e-commerce de l'équipe · <span style="text-decoration: line-through;">899&nbsp;€</span> <strong>offertes</strong></p>
  </div>

  <!-- CE QUE TU OBTIENS -->
  <div style="background-color: #ffffff; border: 2px solid #d6efff; border-radius: 16px; padding: 18px 20px; margin: 0 0 14px 0;">
    <p style="font-size: 18px; font-weight: 800; color: #003366; text-align: center; margin: 0 0 12px 0;">🎁 Tout ce que tu obtiens</p>
    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
      <div style="flex: 1 1 260px; background-color: #f0f9ff; border-radius: 12px; padding: 10px 14px; font-size: 14px; color: #003366;"><strong>🎓 La formation complète Déclic Scutify</strong></div>
      <div style="flex: 1 1 260px; background-color: #f0f9ff; border-radius: 12px; padding: 10px 14px; font-size: 14px; color: #003366;">🔄 <strong>Bonus 1</strong> · Mises à jour à vie <span style="color: #0077b3; font-weight: 700;">(699&nbsp;€)</span></div>
      <div style="flex: 1 1 260px; background-color: #f0f9ff; border-radius: 12px; padding: 10px 14px; font-size: 14px; color: #003366;">🎬 <strong>Bonus 2</strong> · 2 masterclass secrètes de Richard <span style="color: #0077b3; font-weight: 700;">(499&nbsp;€)</span></div>
      <div style="flex: 1 1 260px; background-color: #f0f9ff; border-radius: 12px; padding: 10px 14px; font-size: 14px; color: #003366;">🌍 <strong>Bonus 3</strong> · Réseau de fournisseurs mondial <span style="color: #0077b3; font-weight: 700;">(899&nbsp;€)</span></div>
      <div style="flex: 1 1 260px; background-color: #f0f9ff; border-radius: 12px; padding: 10px 14px; font-size: 14px; color: #003366;">🤝 <strong>Bonus 4</strong> · Groupe d'entraide à vie <span style="color: #0077b3; font-weight: 700;">(359&nbsp;€/an)</span></div>
      <div style="flex: 1 1 260px; background-color: #f0f9ff; border-radius: 12px; padding: 10px 14px; font-size: 14px; color: #003366;">📚 <strong>Bonus 5</strong> · Des dizaines d'ebooks e-commerce <span style="color: #0077b3; font-weight: 700;">(299&nbsp;€)</span></div>
    </div>
  </div>

  <!-- CTA FINAL -->
  <div style="text-align: center; margin: 0 0 14px 0;">
    <a href="https://www.scutify-club.com/offers/ym7bNY2K/checkout" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #003366; color: #ffffff; font-size: 18px; font-weight: 800; text-decoration: none; padding: 17px 38px; border-radius: 50px; border: 3px solid #66ccff;">👉 Je profite de l'offre à 997&nbsp;€</a>
  </div>

  <!-- AIDE -->
  <div style="background-color: #f0f9ff; border-radius: 14px; padding: 12px 16px; text-align: center;">
    <p style="font-size: 14px; color: #003366; margin: 0;">Un souci pour payer ? Écris-nous sur WhatsApp : <a href="https://wa.me/33756851172" target="_blank" rel="noopener noreferrer" style="color: #0077b3; font-weight: 800; text-decoration: underline;">+33 7 56 85 11 72</a></p>
  </div>

</div>
$offer$, E'\n')
 where id = 1;

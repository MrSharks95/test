-- =============================================================================
-- Scutify Live — réglages et contenus à la fin du live du 02/11/2026
--
-- À exécuter APRÈS les migrations. Le bloc « Offre » (997 €) est déjà chargé
-- par la migration 20261102120000_offer_pin_toggles.sql (identique à celui du
-- live : md5 8b7c11fd0b47ee12a2db88e80b8445bd). À METTRE À JOUR pour le
-- prochain live : date du compte à rebours, épingle, offre, lien StreamYard
-- (chaque nouvelle diffusion StreamYard a un nouveau lien).
-- =============================================================================

update public.chat_settings
   set chat_enabled = false,
       live_open = false,            -- salle d'attente
       live_ended = false,
       live_starts_at = null,        -- à régler dans l'admin (« modifier »)
       slow_mode_seconds = 10,       -- 5 s pendant le live ; 10 s conseillé
       links_allowed = false,
       reactions_enabled = true,
       broadcast_interval_seconds = 3,
       ip_message_limit = 20,
       ip_profile_limit = 30,
       reaction_user_limit = 8,
       ip_reaction_limit = 150,
       pinned_message = 'Rejoins Déclic Scutify ce soir si vous avez des soucis de paiement ou des questions sur whatsapp : +33 7 56 85 11 72',
       pinned_label = '👉 Je profite de l’offre',
       pinned_url = 'https://www.scutify-club.com/offers/ym7bNY2K/checkout',
       pinned_enabled = false,
       custom_html_enabled = false,
       stream_url = null,            -- coller la nouvelle diffusion dans l'admin
       quick_replies = null,
       quick_replies_until = null
 where id = 1;

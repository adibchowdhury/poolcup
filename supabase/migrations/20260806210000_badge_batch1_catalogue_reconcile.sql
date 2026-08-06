-- Batch 1: Badge catalogue reconcile (NAMES + list_order + art_filename + XP + is_active)
-- Applied with user confirmation.
--
-- Rules:
-- - Never change achievements.id
-- - Never delete achievements rows (preserve user_achievements FKs)
-- - Do not change condition_metric / threshold on EXISTING matched rows
-- - NEW / DEFERRED: pending_* metrics (not awardable yet)
-- - Leftovers: is_active = false (hidden from catalogue; earned still shown in UI)

BEGIN;

-- Visibility flag for catalogue browse (earned leftovers stay in user_achievements)
ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- A) UPDATE matched existing rows — name, order, art, XP (where retuned)
-- ---------------------------------------------------------------------------

UPDATE public.achievements SET
  name = 'Welcome',
  list_order = 1,
  sort_order = 1,
  art_filename = '01_welcome_badge.png',
  is_active = true
WHERE id = 'welcome_aboard';

UPDATE public.achievements SET
  name = 'First Steps',
  list_order = 2,
  sort_order = 2,
  art_filename = '02_first_steps_badge.png',
  is_active = true
WHERE id = 'first_steps';

UPDATE public.achievements SET
  name = 'Pool Party',
  list_order = 3,
  sort_order = 3,
  art_filename = '03_pool_party_badge.png',
  is_active = true
WHERE id = 'pool_rookie';

UPDATE public.achievements SET
  name = 'Pool Host',
  list_order = 4,
  sort_order = 4,
  art_filename = '04_pool_host_badge.png',
  is_active = true
WHERE id = 'first_pool';

UPDATE public.achievements SET
  name = 'Profile Perfect',
  list_order = 5,
  sort_order = 5,
  art_filename = '05_profile_perfect_badge.png',
  is_active = true
WHERE id = 'picture_perfect';

UPDATE public.achievements SET
  name = 'Picture Perfect',
  list_order = 6,
  sort_order = 6,
  art_filename = '06_picture_perfect_badge.png',
  is_active = true
WHERE id = 'exact_1';

UPDATE public.achievements SET
  name = 'Bullseye',
  list_order = 7,
  sort_order = 7,
  art_filename = '07_bullseye_badge.png',
  is_active = true
WHERE id = 'exact_5';

UPDATE public.achievements SET
  name = 'Deadeye',
  list_order = 9,
  sort_order = 9,
  art_filename = '09_deadeye_badge.png',
  is_active = true
WHERE id = 'exact_25';

UPDATE public.achievements SET
  name = 'Century Club',
  list_order = 11,
  sort_order = 11,
  art_filename = '11_century_club_badge.png',
  is_active = true
WHERE id = 'predict_100';

UPDATE public.achievements SET
  name = 'Prediction Machine',
  list_order = 12,
  sort_order = 12,
  art_filename = '12_prediction_machine_badge.png',
  is_active = true
WHERE id = 'predict_500';

UPDATE public.achievements SET
  name = 'On Fire',
  list_order = 15,
  sort_order = 15,
  art_filename = '15_on_fire_badge.png',
  is_active = true
WHERE id = 'streak_correct_5';

UPDATE public.achievements SET
  name = 'Unstoppable',
  list_order = 16,
  sort_order = 16,
  art_filename = '16_unstoppable_badge.png',
  is_active = true
WHERE id = 'streak_correct_10';

UPDATE public.achievements SET
  name = 'Perfect Day',
  list_order = 17,
  sort_order = 17,
  art_filename = '17_perfect_day_badge.png',
  is_active = true
WHERE id = 'perfect_matchday';

UPDATE public.achievements SET
  name = 'First Podium',
  list_order = 25,
  sort_order = 25,
  art_filename = '25_first_podium_badge.png',
  is_active = true
WHERE id = 'rank_top3';

UPDATE public.achievements SET
  name = 'Champion',
  list_order = 26,
  sort_order = 26,
  art_filename = '26_champion_badge.png',
  is_active = true
WHERE id = 'rank_1';

-- Was Dynasty @ 1000 XP; retuned for "5 pool wins" (Champion=300, new Dynasty×10=1200)
UPDATE public.achievements SET
  name = 'Trophy Cabinet',
  list_order = 28,
  sort_order = 28,
  art_filename = '28_trophy_cabinet_badge.png',
  xp_value = 700,
  is_active = true
WHERE id = 'rank_1_x5';

UPDATE public.achievements SET
  name = 'Recruiter',
  list_order = 37,
  sort_order = 37,
  art_filename = '37_recruiter_badge.png',
  is_active = true
WHERE id = 'invite_1';

-- Points ladder XP retuned to fit new names / difficulty
UPDATE public.achievements SET
  name = 'Rookie',
  list_order = 48,
  sort_order = 48,
  art_filename = '48_rookie_badge.png',
  xp_value = 100,
  is_active = true
WHERE id = 'points_100';

UPDATE public.achievements SET
  name = 'Rising Star',
  list_order = 49,
  sort_order = 49,
  art_filename = '49_rising_star_badge.png',
  xp_value = 175,
  is_active = true
WHERE id = 'points_500';

UPDATE public.achievements SET
  name = 'Contender',
  list_order = 50,
  sort_order = 50,
  art_filename = '50_contender_badge.png',
  xp_value = 300,
  is_active = true
WHERE id = 'points_1000';

UPDATE public.achievements SET
  name = 'Legend',
  list_order = 52,
  sort_order = 52,
  art_filename = '52_legend_badge.png',
  xp_value = 650,
  is_active = true
WHERE id = 'points_5000';

UPDATE public.achievements SET
  name = 'PoolCup Royalty',
  list_order = 53,
  sort_order = 53,
  art_filename = '53_poolcup_royalty_badge.png',
  xp_value = 1000,
  is_active = true
WHERE id = 'points_10000';

-- ---------------------------------------------------------------------------
-- B) INSERT NEW-BUILDABLE (30)
-- ---------------------------------------------------------------------------

INSERT INTO public.achievements (
  id, name, description, category, condition_metric, threshold, tier, xp_value,
  buildable, sort_order, list_order, art_filename, is_active
) VALUES
('exact_10', 'Sharpshooter', 'Get 10 exact scores', 'Accuracy & Correctness', 'pending_batch2', 1, '—', 150, 'yellow', 8, 8, '08_sharpshooter_badge.png', true),
('exact_50', 'Oracle', 'Get 50 exact scores', 'Accuracy & Correctness', 'pending_batch2', 1, '—', 400, 'yellow', 10, 10, '10_oracle_badge.png', true),
('no_days_off', 'No Days Off', 'Predict every match in an event', 'Prediction Volume', 'pending_batch2', 1, '—', 350, 'yellow', 13, 13, '13_no_days_off_badge.png', true),
('heating_up', 'Heating Up', '3 correct predictions in a row', 'Engagement & Streaks', 'pending_batch2', 1, '—', 75, 'yellow', 14, 14, '14_heating_up_badge.png', true),
('perfect_week', 'Perfect Week', 'At least one correct prediction every day for 7 days', 'Engagement & Streaks', 'pending_batch2', 1, '—', 200, 'yellow', 18, 18, '18_perfect_week_badge.png', true),
('called_it', 'Called It', 'Correctly predict an upset', 'Upsets & Edge Calls', 'pending_batch2', 1, '—', 100, 'yellow', 19, 19, '19_called_it_badge.png', true),
('giant_killer', 'Giant Killer', 'Correctly predict 5 upsets', 'Upsets & Edge Calls', 'pending_batch2', 1, '—', 300, 'yellow', 20, 20, '20_giant_killer_badge.png', true),
('against_the_crowd', 'Against the Crowd', 'Win a prediction where most users picked the other side', 'Upsets & Edge Calls', 'pending_batch2', 1, '—', 150, 'yellow', 21, 21, '21_against_the_crowd_badge.png', true),
('nobody_believed_me', 'Nobody Believed Me', 'Correctly predict a major underdog', 'Upsets & Edge Calls', 'pending_batch2', 1, '—', 250, 'yellow', 22, 22, '22_nobody_believed_me_badge.png', true),
('nail_biter', 'Nail Biter', 'Correctly predict a one-goal game', 'Upsets & Edge Calls', 'pending_batch2', 1, '—', 100, 'yellow', 23, 23, '23_nail_biter_badge.png', true),
('draw_master', 'Draw Master', 'Correctly predict 5 draws', 'Upsets & Edge Calls', 'pending_batch2', 1, '—', 200, 'yellow', 24, 24, '24_draw_master_badge.png', true),
('rank_1_x2', 'Repeat Champion', 'Win 2 pools', 'Ranking & Competition', 'pending_batch2', 1, '—', 450, 'yellow', 27, 27, '27_repeat_champion_badge.png', true),
('rank_1_x10', 'Dynasty', 'Win 10 pools', 'Ranking & Competition', 'pending_batch2', 1, '—', 1200, 'yellow', 29, 29, '29_dynasty_badge.png', true),
('big_fish', 'Big Fish', 'Win a pool with 25+ players', 'Ranking & Competition', 'pending_batch2', 1, '—', 400, 'yellow', 30, 30, '30_big_fish_badge.png', true),
('shark_tank', 'Shark Tank', 'Win a pool with 100+ players', 'Ranking & Competition', 'pending_batch2', 1, '—', 800, 'yellow', 31, 31, '31_shark_tank_badge.png', true),
('photo_finish', 'Photo Finish', 'Win a pool by the smallest possible margin', 'Ranking & Competition', 'pending_batch2', 1, '—', 350, 'yellow', 32, 32, '32_photo_finish_badge.png', true),
('say_hello', 'Say Hello', 'Send your first pool chat message', 'Social & Invites', 'pending_batch2', 1, '—', 25, 'yellow', 33, 33, '33_say_hello_badge.png', true),
('talk_smack', 'Talk Smack', 'Send 25 pool chat messages', 'Social & Invites', 'pending_batch2', 1, '—', 100, 'yellow', 34, 34, '34_talk_smack_badge.png', true),
('crowd_favorite', 'Crowd Favorite', 'Receive 10 reactions', 'Social & Invites', 'pending_batch2', 1, '—', 100, 'yellow', 35, 35, '35_crowd_favorite_badge.png', true),
('fan_favorite', 'Fan Favorite', 'Receive 50 reactions', 'Social & Invites', 'pending_batch2', 1, '—', 300, 'yellow', 36, 36, '36_fan_favorite_badge.png', true),
('squad_builder', 'Squad Builder', 'Get 5 people to join your pool', 'Social & Invites', 'pending_batch2', 1, '—', 150, 'yellow', 38, 38, '38_squad_builder_badge.png', true),
('pack_leader', 'Pack Leader', 'Get 25 people to join your pool', 'Social & Invites', 'pending_batch2', 1, '—', 400, 'yellow', 39, 39, '39_pack_leader_badge.png', true),
('points_2500', 'Elite', 'Reach 2,500 PoolCup points', 'Points Milestones', 'pending_batch2', 1, '—', 450, 'yellow', 51, 51, '51_elite_badge.png', true),
('lucky_guess', 'Lucky Guess', 'Nail an exact score on your first prediction', 'Rare & Fun', 'pending_batch2', 1, '—', 150, 'yellow', 54, 54, '54_lucky_guess_badge.png', true),
('comeback_kid', 'Comeback Kid', 'Go from the bottom half of a pool to Top 3', 'Rare & Fun', 'pending_batch2', 1, '—', 350, 'yellow', 55, 55, '55_comeback_kid_badge.png', true),
('clutch', 'Clutch', 'Nail an exact score near the end of an event', 'Rare & Fun', 'pending_batch2', 1, '—', 250, 'yellow', 56, 56, '56_clutch_badge.png', true),
('early_bird', 'Early Bird', 'Submit 10 predictions 24+ hours early', 'Rare & Fun', 'pending_batch2', 1, '—', 150, 'yellow', 57, 57, '57_early_bird_badge.png', true),
('last_minute', 'Last Minute', 'Make a correct prediction shortly before predictions lock', 'Rare & Fun', 'pending_batch2', 1, '—', 150, 'yellow', 58, 58, '58_last_minute_badge.png', true),
('contrarian', 'Contrarian', 'Correctly go against the majority 10 times', 'Rare & Fun', 'pending_batch2', 1, '—', 400, 'yellow', 59, 59, '59_contrarian_badge.png', true),
('clean_sweep', 'Clean Sweep', 'Win every available prediction in a matchday/round', 'Rare & Fun', 'pending_batch2', 1, '—', 400, 'yellow', 60, 60, '60_clean_sweep_badge.png', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- C) INSERT DEFERRED Multi-Sport (8)
-- ---------------------------------------------------------------------------

INSERT INTO public.achievements (
  id, name, description, category, condition_metric, threshold, tier, xp_value,
  buildable, sort_order, list_order, art_filename, is_active
) VALUES
('soccer_fan', 'Soccer Fan', 'Make 25 soccer predictions', 'Multi-Sport', 'pending_multisport', 1, '—', 100, 'yellow', 40, 40, '40_soccer_fan_badge.png', true),
('hooper', 'Hooper', 'Make 25 basketball predictions', 'Multi-Sport', 'pending_multisport', 1, '—', 100, 'yellow', 41, 41, '41_hooper_badge.png', true),
('sunday_expert', 'Sunday Expert', 'Make 25 football predictions', 'Multi-Sport', 'pending_multisport', 1, '—', 100, 'yellow', 42, 42, '42_sunday_expert_badge.png', true),
('puck_head', 'Puck Head', 'Make 25 hockey predictions', 'Multi-Sport', 'pending_multisport', 1, '—', 100, 'yellow', 43, 43, '43_puck_head_badge.png', true),
('home_run', 'Home Run', 'Make 25 baseball predictions', 'Multi-Sport', 'pending_multisport', 1, '—', 100, 'yellow', 44, 44, '44_home_run_badge.png', true),
('ace', 'Ace', 'Make 25 tennis predictions', 'Multi-Sport', 'pending_multisport', 1, '—', 100, 'yellow', 45, 45, '45_ace_badge.png', true),
('all_rounder', 'All-Rounder', 'Predict across 3 different sports', 'Multi-Sport', 'pending_multisport', 1, '—', 250, 'yellow', 46, 46, '46_all_rounder_badge.png', true),
('sports_addict', 'Sports Addict', 'Predict across 5 different sports', 'Multi-Sport', 'pending_multisport', 1, '—', 500, 'yellow', 47, 47, '47_sports_addict_badge.png', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- D) Retire leftovers (not in the 60) — keep rows + earned; hide from catalogue
-- ---------------------------------------------------------------------------

UPDATE public.achievements
SET
  is_active = false,
  list_order = NULL
WHERE id IN (
  'predict_10', 'predict_50', 'predict_250', 'predict_1000',
  'correct_1', 'correct_10', 'correct_50', 'correct_100', 'correct_500',
  'exact_100', 'points_25000',
  'join_3', 'join_5', 'join_10', 'create_3', 'create_5', 'create_10',
  'official_join', 'events_3', 'events_5',
  'rank_top10', 'rank_1_x3', 'official_podium', 'perfect_event',
  'pool_10_members', 'pool_50_members', 'pool_100_members',
  'streak_correct_20', 'streak_days_7', 'streak_days_30', 'streak_days_100',
  'invite_5', 'invite_10', 'invite_25',
  'early_adopter', 'veteran', 'completionist_25', 'completionist_50'
);

DO $$
DECLARE
  listed int;
  inactive int;
BEGIN
  SELECT count(*) INTO listed
  FROM public.achievements
  WHERE is_active = true AND list_order IS NOT NULL;

  SELECT count(*) INTO inactive
  FROM public.achievements
  WHERE is_active = false;

  IF listed <> 60 THEN
    RAISE EXCEPTION 'Expected 60 active listed achievements, found %', listed;
  END IF;
  IF inactive < 38 THEN
    RAISE EXCEPTION 'Expected at least 38 retired leftovers, found %', inactive;
  END IF;
END $$;

COMMIT;

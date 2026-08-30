import React, { useState } from 'react';
import { Award, Zap, Heart, Shield, Flame, ChevronDown, ChevronUp } from 'lucide-react';

interface DonorBadgesProps {
  donationCount: number;
}

export interface BadgeTier {
  name: string;
  donationsNeeded: number;
  icon: React.ReactNode;
  color: string;
  description: string;
  xpNeeded: number;
}

export const BADGE_TIERS: BadgeTier[] = [
  {
    name: 'Blood Recruit',
    donationsNeeded: 0,
    icon: <Shield className="w-8 h-8 text-blood-600" />,
    color: 'border-blood-200 bg-blood-50 text-blood-700',
    description: 'Registered as a lifesaving donor',
    xpNeeded: 50,
  },
  {
    name: 'Life Giver',
    donationsNeeded: 1,
    icon: <Heart className="w-8 h-8 text-blood-600 fill-blood-600/20" />,
    color: 'border-blood-200 bg-blood-50 text-blood-700',
    description: 'Completed your first blood donation',
    xpNeeded: 250,
  },
  {
    name: 'Community Hero',
    donationsNeeded: 3,
    icon: <Flame className="w-8 h-8 text-blood-600 fill-blood-600/20" />,
    color: 'border-blood-200 bg-blood-50 text-blood-700',
    description: '3 donations logged. Highly active responder.',
    xpNeeded: 650,
  },
  {
    name: 'Blood Champion',
    donationsNeeded: 6,
    icon: <Zap className="w-8 h-8 text-blood-600 fill-blood-600/20" />,
    color: 'border-blood-200 bg-blood-50 text-blood-700',
    description: '6 donations logged. Lifesaver status.',
    xpNeeded: 1250,
  },
  {
    name: 'FindMyDonor™ Legend',
    donationsNeeded: 12,
    icon: <Award className="w-10 h-10 text-blood-600 fill-blood-600/20" />,
    color: 'border-blood-200 bg-blood-50 text-blood-700',
    description: '12+ donations. Absolute community pillar.',
    xpNeeded: 2450,
  },
];

export function getDonorStats(donationCount: number) {
  // Base XP computation
  // Registering = 50 XP
  // Profile complete = 50 XP
  // External self-report = 100 XP
  // Matches donated = 200 XP
  const xp = 100 + donationCount * 200;

  // Find current tier
  let currentTier = BADGE_TIERS[0];
  let nextTier = BADGE_TIERS[1];

  for (let i = 0; i < BADGE_TIERS.length; i++) {
    if (donationCount >= BADGE_TIERS[i].donationsNeeded) {
      currentTier = BADGE_TIERS[i];
      nextTier = BADGE_TIERS[i + 1] || BADGE_TIERS[i]; // cap at legend
    }
  }

  const livesSaved = donationCount * 3;
  const isMaxTier = currentTier === nextTier;
  const progressPercent = isMaxTier
    ? 100
    : Math.min(
        100,
        ((donationCount - currentTier.donationsNeeded) /
          (nextTier.donationsNeeded - currentTier.donationsNeeded)) *
          100
      );

  return {
    xp,
    currentTier,
    nextTier,
    livesSaved,
    progressPercent,
    isMaxTier,
  };
}

export default function DonorBadges({ donationCount }: DonorBadgesProps) {
  const { xp, currentTier, nextTier, livesSaved, progressPercent, isMaxTier } = getDonorStats(donationCount);
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="space-y-6 border border-ink-200 bg-white p-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-display text-lg font-bold tracking-tight text-ink-900">Lifesaver Level</h3>
          <p className="text-xs text-ink-500">Every donation saves up to 3 lives</p>
        </div>
        <span className="inline-flex items-center border border-blood-200 bg-blood-50 px-3 py-1 font-mono text-xs font-bold text-blood-700">
          🔥 Level {Math.max(1, Math.floor(xp / 400))}
        </span>
      </div>

      {/* Progress Card */}
      <div className="border border-ink-200 bg-ink-50 p-5 text-ink-900">
        <div className="flex items-center gap-4">
          <div className={`flex items-center justify-center border border-blood-500/30 bg-blood-500/10 p-3 text-blood-600`}>
            {currentTier.icon}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">Current Badge</span>
            <h4 className="truncate text-lg font-extrabold text-ink-900">{currentTier.name}</h4>
            <p className="text-xs font-semibold text-ink-600">{livesSaved} lives saved so far</p>
          </div>
        </div>

        {/* XP Bar */}
        <div className="mt-5 space-y-2">
          <div className="flex justify-between font-mono text-[11px] font-semibold tabular-nums text-ink-600">
            <span>{xp} XP earned</span>
            {!isMaxTier && (
              <span>
                {nextTier.donationsNeeded - donationCount} more donation(s) to {nextTier.name}
              </span>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden bg-ink-100">
            <div
              className="h-full bg-blood-600 transition-all duration-1000 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Collapsed badge summary + toggle */}
      <button
        id="btn-donor-badges-toggle"
        type="button"
        onClick={() => setShowAll(v => !v)}
        className="flex w-full items-center justify-between border border-ink-200 bg-ink-50 p-3 text-left transition-colors hover:bg-ink-100 cursor-pointer"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          All Badges
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-ink-700">
          {showAll ? 'Hide badges' : 'View all badges'}
          {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {/* Showcase list */}
      {showAll && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5">
            {BADGE_TIERS.map((tier) => {
              const unlocked = donationCount >= tier.donationsNeeded;
              return (
                <div
                  key={tier.name}
                  className={`flex items-center gap-3 border p-3.5 transition-colors ${
                    unlocked
                      ? tier.color
                      : 'border border-ink-200 bg-white opacity-40'
                  }`}
                >
                  <div className={`border border-ink-200 bg-white p-1.5`}>
                    {React.cloneElement(tier.icon as React.ReactElement<{ className?: string }>, { className: 'w-6 h-6' })}
                  </div>
                  <div>
                    <h5 className="flex items-center gap-1.5 text-xs font-bold">
                      {tier.name}
                      {unlocked && <span className="bg-blood-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">✓ Unlocked</span>}
                    </h5>
                    <p className="text-[10px] font-semibold text-ink-500">{tier.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

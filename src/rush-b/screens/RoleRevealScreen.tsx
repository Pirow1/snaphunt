import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';

type Props = {
  role: 'planter' | 'defuser';
  planterName: string | null;
  onAccept: () => void;
};

export default function RoleRevealScreen({ role, planterName, onAccept }: Props) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); }, []);

  const isPlanter = role === 'planter';

  return (
    <main className="flex h-full w-full flex-col items-center justify-center bg-void px-6 text-center gap-6">
      <div className="warning-stripe h-[8px] w-full absolute top-0 left-0" />

      <div className={`transition-all duration-500 ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
        <div className="font-rb-mono text-[11px] uppercase tracking-[0.35em] text-ash mb-3">
          Your role this round
        </div>
        <div className={`font-rb-display text-[72px] leading-none ${isPlanter ? 'text-threat' : 'text-spark'}`}>
          {isPlanter ? '💣' : '🔍'}
        </div>
        <div className={`font-rb-display text-[44px] tracking-[0.06em] mt-2 ${isPlanter ? 'text-threat' : 'text-spark'}`}>
          {isPlanter ? 'PLANTER' : 'DEFUSER'}
        </div>
        <div className="mt-3 font-rb-mono text-[12px] text-ash max-w-[240px] mx-auto leading-relaxed">
          {isPlanter
            ? 'Plant the bomb. Set the timer.\nLet the chaos begin.'
            : `${planterName ?? 'The planter'} has hidden the bomb.\nFind it. Defuse it. Don't die.`}
        </div>
      </div>

      <Button
        variant={isPlanter ? 'danger' : 'primary'}
        className="max-w-[260px]"
        onClick={onAccept}
      >
        {isPlanter ? '▶ PLANT BOMB' : '▶ START HUNT'}
      </Button>

      <div className="warning-stripe h-[8px] w-full absolute bottom-0 left-0" />
    </main>
  );
}

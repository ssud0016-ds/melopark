import { calcCarbon } from '../../utils/carbonModel';

const C = {
  high:{ bar:'#3B6D11', pill:'#EAF3DE', text:'#27500A' },
  mid: { bar:'#BA7517', pill:'#FAEEDA', text:'#633806' },
  low: { bar:'#888780', pill:'#F1EFE8', text:'#444441' },
};

export default function CarbonComparisonRow({ bay, isBest }) {
  const data = calcCarbon({ occupancyPct: bay.occupancyPct, walkMetres: bay.walkMetres });
  const t = data ? (data.score>=65?'high':data.score>=35?'mid':'low') : null;
  const c = t ? C[t] : null;
  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 ${isBest?'rounded-lg px-2':''}`} style={isBest?{background:'#EAF3DE'}:{}}>
      <div className="w-4 text-center" style={{color:'#3B6D11',fontSize:12}}>{isBest?'★':''}</div>
      <div className="w-28 flex-shrink-0">
        <p className="text-sm font-medium leading-tight">{bay.id}</p>
        <p className="text-xs" style={{color:'var(--color-text-secondary)'}}>{bay.street}</p>
      </div>
      {data ? (
        <>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'var(--color-background-secondary)'}}>
            <div className="h-full rounded-full" style={{width:`${data.pct}%`,background:c.bar,transition:'width .5s ease'}} />
          </div>
          <span className="text-xs font-medium w-8 text-right" style={{color:c.text}}>{data.pct}%</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{background:c.pill,color:c.text}}>{data.score}/100</span>
        </>
      ) : (
        <span className="flex-1 text-xs italic" style={{color:'var(--color-text-secondary)'}}>Sensor offline</span>
      )}
    </div>
  );
}

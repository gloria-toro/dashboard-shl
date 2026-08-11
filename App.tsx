import { useState, useMemo, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const SHEET_URL = "https://script.google.com/macros/s/AKfycby1pd4D12iWeXji_Dqv6xkm4ohEt-tv0Kg-V8cx1Ge5HafSQ0lYNnKaa5pi0t2vxBdm/exec";
const MESES_ORDER = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const CANAL_COLORS: Record<string,string> = { Shopify:'#3A86FF', Marketplaces:'#06D6A0', Tiendas:'#FF7A59', B2B:'#8338EC' };
const CANAL_ICONS: Record<string,string>  = { Shopify:'🛒', Marketplaces:'🏪', Tiendas:'🏬', B2B:'🤝' };
const EMP_COLORS = ['#6366f1','#22c55e','#f59e0b','#ec4899','#38bdf8','#fb7185'];
const METRIC_COLORS: Record<string,string> = { ventas:'#6366f1', costo:'#f43f5e', marketing:'#f59e0b' };

const fmt     = (v: number) => `$${(v/1000).toFixed(1)}k`;
const fmtFull = (v: number) => `$${Math.round(v).toLocaleString("es-CL")}`;
const pct     = (a: number, b: number) => b ? `${((a/b)*100).toFixed(1)}%` : '—';
const roasFmt = (v: number, m: number) => m ? `${(v/m).toFixed(2)}x` : '—';
const yoyLabel = (curr: number, prev: number) => {
  if (!prev) return null;
  const v = ((curr-prev)/prev)*100;
  return { val:`${v>=0?'▲':'▼'} ${Math.abs(v).toFixed(1)}% vs año ant.`, positive: v>=0 };
};

interface Row {
  año: string; mes: string; empresa: string; canal: string;
  ventas: number; costo: number; marketing: number;
  presupuesto_ventas: number; presupuesto_costo: number; presupuesto_marketing: number;
}
interface Totals { v:number; c:number; m:number; pv:number; pc:number; pm:number; }

function calcTotals(rows: Row[]): Totals {
  return rows.reduce((a,d) => ({
    v: a.v+d.ventas, c: a.c+d.costo, m: a.m+d.marketing,
    pv: a.pv+(d.presupuesto_ventas||0), pc: a.pc+(d.presupuesto_costo||0), pm: a.pm+(d.presupuesto_marketing||0)
  }), {v:0,c:0,m:0,pv:0,pc:0,pm:0});
}

const KPI = ({ label, value, sub, color, yoyInfo }: any) => (
  <div style={{ background:'#1e1e2e', borderRadius:12, padding:'16px 18px', borderLeft:`4px solid ${color}` }}>
    <div style={{ color:'#888', fontSize:10, marginBottom:4, textTransform:'uppercase', letterSpacing:1 }}>{label}</div>
    <div style={{ color:'#fff', fontSize:20, fontWeight:700 }}>{value}</div>
    {sub && <div style={{ color, fontSize:11, marginTop:3 }}>{sub}</div>}
    {yoyInfo && <div style={{ color:yoyInfo.positive?'#22c55e':'#f43f5e', fontSize:11, marginTop:4, fontWeight:600 }}>{yoyInfo.val}</div>}
  </div>
);

const RatioCard = ({ label, value, desc, color }: any) => (
  <div style={{ background:'#1e1e2e', borderRadius:12, padding:'14px 16px', border:`1px solid ${color}33` }}>
    <div style={{ color:'#888', fontSize:10, textTransform:'uppercase', letterSpacing:1, marginBottom:5 }}>{label}</div>
    <div style={{ color, fontSize:24, fontWeight:800 }}>{value}</div>
    <div style={{ color:'#555', fontSize:10, marginTop:3 }}>{desc}</div>
  </div>
);

const Toggle = ({ label, color, active, onClick }: any) => (
  <button onClick={onClick} style={{ background:active?color+'22':'#1e1e2e', border:`1px solid ${active?color:'#333'}`, color:active?color:'#666', borderRadius:20, padding:'4px 12px', fontSize:11, cursor:'pointer' }}>
    {label}
  </button>
);

// ─── GRÁFICA YoY Shopify ───────────────────────────────────────────
function GraficaYoY({ rawData, empresa, yearCurr, yearPrev, mesDesde, mesHasta }: any) {
  const data = useMemo(() => MESES_ORDER.slice(mesDesde, mesHasta+1).map(mes => {
    const curr = rawData.filter((r:Row) => r.empresa===empresa && String(r.año)===String(yearCurr) && r.mes===mes && r.canal==="Shopify");
    const prev = rawData.filter((r:Row) => r.empresa===empresa && String(r.año)===String(yearPrev) && r.mes===mes && r.canal==="Shopify");
    const sumV = (a:Row[]) => a.reduce((s,d)=>s+d.ventas,0);
    const sumC = (a:Row[]) => a.reduce((s,d)=>s+d.costo,0);
    const sumM = (a:Row[]) => a.reduce((s,d)=>s+d.marketing,0);
    const vC=sumV(curr), vP=sumV(prev);
    return {
      month:mes,
      "% Costo actual":   vC>0?+((sumC(curr)/vC)*100).toFixed(1):0,
      "% Costo anterior": vP>0?+((sumC(prev)/vP)*100).toFixed(1):0,
      "% Mktg actual":    vC>0?+((sumM(curr)/vC)*100).toFixed(1):0,
      "% Mktg anterior":  vP>0?+((sumM(prev)/vP)*100).toFixed(1):0,
    };
  }), [rawData,empresa,yearCurr,yearPrev,mesDesde,mesHasta]);

  const esMesSolo = data.length===1;
  const tooltipContent = ({ active, payload, label }: any) => {
    if (!active||!payload?.length) return null;
    const g = [
      { label:"% Costo", color:METRIC_COLORS.costo, actual:payload.find((p:any)=>p.name==="% Costo actual")?.value, anterior:payload.find((p:any)=>p.name==="% Costo anterior")?.value },
      { label:"% Mktg",  color:METRIC_COLORS.marketing, actual:payload.find((p:any)=>p.name==="% Mktg actual")?.value, anterior:payload.find((p:any)=>p.name==="% Mktg anterior")?.value },
    ];
    return (
      <div style={{ background:"rgba(20,20,35,0.85)", border:"1px solid #333", borderRadius:8, padding:"5px 10px", fontSize:13, pointerEvents:"none" }}>
        <div style={{ color:"#fff", marginBottom:3, fontWeight:600 }}>{label}</div>
        {g.map((x,i) => <div key={i} style={{ color:x.color, padding:"1px 0" }}>{x.label}: {x.actual}% <span style={{ color:"#888", fontSize:12 }}>({x.anterior}%)</span></div>)}
      </div>
    );
  };
  const common = <>
    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
    <XAxis dataKey="month" stroke="#555" tick={{ fill:"#888", fontSize:11 }} />
    <YAxis stroke="#555" tick={{ fill:"#888", fontSize:11 }} tickFormatter={v=>`${Number(v).toFixed(1)}%`} />
    <Tooltip cursor={{ fill:"transparent" }} content={tooltipContent} />
    <Legend wrapperStyle={{ fontSize:13 }} />
  </>;
  return (
    <div style={{ background:"#1e1e2e", borderRadius:12, padding:18, marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <h3 style={{ margin:0, fontSize:13, color:"#ccc" }}>Shopify — % Costo y % Marketing sobre ventas</h3>
        <div style={{ display:"flex", gap:6 }}>
          <span style={{ color:"#555", fontSize:11 }}>Actual</span>
          <span style={{ color:"#555", fontSize:11 }}>— —</span>
          <span style={{ color:"#555", fontSize:11 }}>Anterior</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={210}>
        {esMesSolo ? (
          <BarChart data={data} barCategoryGap="20%" barGap={4}>
            {common}
            <Bar dataKey="% Costo actual"   fill={METRIC_COLORS.costo}     barSize={28} />
            <Bar dataKey="% Costo anterior" fill="#888888"                 barSize={28} opacity={0.5} />
            <Bar dataKey="% Mktg actual"    fill={METRIC_COLORS.marketing} barSize={28} />
            <Bar dataKey="% Mktg anterior"  fill="#888888"                 barSize={28} opacity={0.5} />
          </BarChart>
        ) : (
          <LineChart data={data}>
            {common}
            <Line type="monotone" dataKey="% Costo actual"   stroke={METRIC_COLORS.costo}     strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="% Costo anterior" stroke="#888888" strokeWidth={1.5} dot={false} strokeDasharray="5 4" opacity={0.7} />
            <Line type="monotone" dataKey="% Mktg actual"    stroke={METRIC_COLORS.marketing}  strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="% Mktg anterior"  stroke="#888888" strokeWidth={1.5} dot={false} strokeDasharray="5 4" opacity={0.7} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ─── GRÁFICA YoY POR CANAL ─────────────────────────────────────────
function GraficaYoYCanal({ rawData, empresa, yearCurr, yearPrev, mesDesde, mesHasta }: any) {
  const [canal, setCanal] = useState("Shopify");
  const [showV, setShowV] = useState(true);
  const [showC, setShowC] = useState(true);
  const [showM, setShowM] = useState(true);

  const dataCanal = useMemo(() => MESES_ORDER.slice(mesDesde, mesHasta+1).map(mes => {
    const curr = rawData.filter((r:Row) => r.empresa===empresa && String(r.año)===String(yearCurr) && r.mes===mes && r.canal===canal);
    const prev = rawData.filter((r:Row) => r.empresa===empresa && String(r.año)===String(yearPrev) && r.mes===mes && r.canal===canal);
    const sum = (arr:Row[], key:keyof Row) => arr.reduce((a,d)=>a+(d[key] as number),0);
    return { month:mes, "Venta actual":sum(curr,"ventas"), "Venta año anterior":sum(prev,"ventas"), "Costo actual":sum(curr,"costo"), "Costo año anterior":sum(prev,"costo"), "Mktg actual":sum(curr,"marketing"), "Mktg año anterior":sum(prev,"marketing") };
  }), [rawData,empresa,yearCurr,yearPrev,canal,mesDesde,mesHasta]);

  const esMesSolo = dataCanal.length===1;
  const tooltipContent = ({ active, payload, label }: any) => {
    if (!active||!payload?.length) return null;
    const g = [
      showV && { label:"Ventas", color:METRIC_COLORS.ventas, actual:payload.find((p:any)=>p.name==="Venta actual")?.value, anterior:payload.find((p:any)=>p.name==="Venta año anterior")?.value },
      showC && { label:"Costo",  color:METRIC_COLORS.costo,  actual:payload.find((p:any)=>p.name==="Costo actual")?.value,  anterior:payload.find((p:any)=>p.name==="Costo año anterior")?.value },
      showM && { label:"Mktg",   color:METRIC_COLORS.marketing, actual:payload.find((p:any)=>p.name==="Mktg actual")?.value, anterior:payload.find((p:any)=>p.name==="Mktg año anterior")?.value },
    ].filter(Boolean);
    return (
      <div style={{ background:"rgba(20,20,35,0.85)", border:"1px solid #333", borderRadius:8, padding:"5px 10px", fontSize:12, pointerEvents:"none" }}>
        <div style={{ color:"#fff", marginBottom:3, fontWeight:600 }}>{label}</div>
        {g.map((x:any,i:number) => <div key={i} style={{ color:x.color, padding:"1px 0" }}>{x.label}: {fmtFull(x.actual)} <span style={{ color:"#888", fontSize:9 }}>({fmtFull(x.anterior)})</span></div>)}
      </div>
    );
  };
  const common = <>
    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
    <XAxis dataKey="month" stroke="#555" tick={{ fill:"#888", fontSize:12 }} />
    <YAxis stroke="#555" tick={{ fill:"#888", fontSize:11 }} tickFormatter={fmt} />
    <Tooltip cursor={{ fill:'transparent' }} content={tooltipContent} />
    <Legend wrapperStyle={{ fontSize:10, paddingTop:8 }} iconSize={8} />
  </>;
  const mkLine = (key:string, stroke:string, dash?:string) => <Line type="monotone" dataKey={key} stroke={stroke} strokeWidth={dash?1.5:2.5} dot={false} strokeDasharray={dash} opacity={dash?0.7:1} />;
  const mkBar  = (key:string, fill:string, op?:number) => <Bar dataKey={key} fill={fill} barSize={28} opacity={op||1} />;

  return (
    <div style={{ background:"#1e1e2e", borderRadius:12, padding:18, marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
        <h3 style={{ margin:0, fontSize:13, color:"#ccc" }}>Año actual vs anterior por canal</h3>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["Shopify","Marketplaces","Tiendas","B2B"].map(c => (
            <button key={c} onClick={()=>setCanal(c)} style={{ background:canal===c?(CANAL_COLORS[c]||"#888")+"33":"#1e1e2e", border:`1px solid ${canal===c?(CANAL_COLORS[c]||"#888"):"#333"}`, color:canal===c?(CANAL_COLORS[c]||"#888"):"#666", borderRadius:20, padding:"3px 12px", fontSize:12, cursor:"pointer" }}>{c}</button>
          ))}
          <div style={{ width:1, background:"#333", margin:"0 4px" }} />
          <Toggle label="Ventas" color={METRIC_COLORS.ventas}    active={showV} onClick={()=>setShowV((p:boolean)=>!p)} />
          <Toggle label="Costo"  color={METRIC_COLORS.costo}     active={showC} onClick={()=>setShowC((p:boolean)=>!p)} />
          <Toggle label="Mktg"   color={METRIC_COLORS.marketing} active={showM} onClick={()=>setShowM((p:boolean)=>!p)} />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={210}>
        {esMesSolo ? (
          <BarChart data={dataCanal} barCategoryGap="20%" barGap={4}>
            {common}
            {showV && <>{mkBar("Venta actual",METRIC_COLORS.ventas)}{mkBar("Venta año anterior","#888888",0.5)}</>}
            {showC && <>{mkBar("Costo actual",METRIC_COLORS.costo)}{mkBar("Costo año anterior","#888888",0.5)}</>}
            {showM && <>{mkBar("Mktg actual",METRIC_COLORS.marketing)}{mkBar("Mktg año anterior","#888888",0.5)}</>}
          </BarChart>
        ) : (
          <LineChart data={dataCanal}>
            {common}
            {showV && <>{mkLine("Venta actual",METRIC_COLORS.ventas)}{mkLine("Venta año anterior","#888888","5 4")}</>}
            {showC && <>{mkLine("Costo actual",METRIC_COLORS.costo)}{mkLine("Costo año anterior","#888888","5 4")}</>}
            {showM && <>{mkLine("Mktg actual",METRIC_COLORS.marketing)}{mkLine("Mktg año anterior","#888888","5 4")}</>}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ─── VISTA INDIVIDUAL ─────────────────────────────────────────────
function VistaIndividual({ rawData, empresas, years, empColors, fechaActualizacion, tipoCambioData, moneda, setMoneda }: any) {
  const [empIdx, setEmpIdx] = useState(0);
  const [yearCurr, setYearCurr] = useState(years[years.length-1]);
  const [yearPrev, setYearPrev] = useState(years[years.length-2]||years[0]);
  const [mesDesde, setMesDesde] = useState(0);
  const [mesHasta, setMesHasta] = useState(11);
  const [canalVista, setCanalVista] = useState('todos');
  const [showV, setShowV] = useState(true);
  const [showC, setShowC] = useState(true);
  const [showM, setShowM] = useState(true);

  const empresa  = empresas[empIdx];
  const empColor = empColors[empIdx]||'#6366f1';

  // Tasa de cambio para la empresa y período seleccionado
  const tasaCambio = useMemo(() => {
    if (moneda === 'USD' || !tipoCambioData?.length) return 1;
    const tasas = MESES_ORDER.slice(mesDesde, mesHasta + 1).map(mes => {
      const tc = tipoCambioData.find((t: any) =>
        t.empresa === empresa && String(t.año) === String(yearCurr) && t.mes === mes
      );
      return tc?.tasa || 0;
    }).filter((t: number) => t > 0);
    if (!tasas.length) return 1;
    return tasas.reduce((a: number, b: number) => a + b, 0) / tasas.length;
  }, [tipoCambioData, empresa, yearCurr, mesDesde, mesHasta, moneda]);
  
  // Símbolo de moneda
  const monedaSymbol = useMemo(() => {
    if (moneda === 'USD') return '$';
    const monedas: Record<string,string> = { 'SHL Chile':'$', 'SHL Col':'$', 'SHL Mx':'$', 'eCompany':'$' };
    return monedas[empresa] || '$';
  }, [moneda, empresa]);

  const conv = (v: number) => moneda === 'LOCAL' ? Math.round(v * tasaCambio) : v;
  const fmtConv = (v: number) => {
    const converted = conv(v);
    if (moneda === 'LOCAL') return `${monedaSymbol}${converted.toLocaleString("es-CL")}`;
    return fmtFull(v);
  };

  const rowsCurr = useMemo(() => MESES_ORDER.slice(mesDesde, mesHasta+1).map(mes => {
    const cns = [...new Set(rawData.filter((r:Row)=>r.empresa===empresa&&String(r.año)===String(yearCurr)).map((r:Row)=>r.canal))] as string[];
    const byCanal: Record<string,any> = {};
    let vT=0,cT=0,mT=0,pvT=0,pcT=0,pmT=0;
    cns.forEach(canal => {
      const r = rawData.find((d:Row)=>d.empresa===empresa&&d.año===String(yearCurr)&&d.mes===mes&&d.canal===canal);
      const v=r?r.ventas:0,c=r?r.costo:0,m=r?r.marketing:0,pv=r?(r.presupuesto_ventas||0):0,pc=r?(r.presupuesto_costo||0):0,pm=r?(r.presupuesto_marketing||0):0;
      byCanal[canal]={ventas:v,costo:c,marketing:m};
      vT+=v;cT+=c;mT+=m;pvT+=pv;pcT+=pc;pmT+=pm;
    });
    return { mes, ventas:vT, costo:cT, marketing:mT, presupuesto_ventas:pvT, presupuesto_costo:pcT, presupuesto_marketing:pmT, canales:byCanal };
  }), [rawData,empresa,yearCurr,mesDesde,mesHasta]);

  const rowsPrev = useMemo(() => MESES_ORDER.slice(mesDesde, mesHasta+1).map(mes => {
    let vT=0,cT=0,mT=0;
    rawData.filter((r:Row)=>r.empresa===empresa&&String(r.año)===String(yearPrev)&&r.mes===mes).forEach((r:Row)=>{vT+=r.ventas;cT+=r.costo;mT+=r.marketing;});
    return { mes, ventas:vT, costo:cT, marketing:mT };
  }), [rawData,empresa,yearPrev,mesDesde,mesHasta]);

  const tC = useMemo(()=>calcTotals(rowsCurr as any),[rowsCurr]);
  const tP = useMemo(()=>calcTotals(rowsPrev as any),[rowsPrev]);
  const gC = tC.v-tC.c-tC.m, gP = tP.v-tP.c-tP.m;

  const CANAL_ORDER = ["Shopify","Marketplaces","Tiendas","B2B"];
  const canales = useMemo(()=>CANAL_ORDER.filter(c=>rawData.some((r:Row)=>r.empresa===empresa&&String(r.año)===String(yearCurr)&&r.canal===c)),[rawData,empresa,yearCurr]);

  const canalTotals = useMemo(()=>canales.map(canal=>{
    const rows = rawData.filter((r:Row)=>r.empresa===empresa&&String(r.año)===String(yearCurr)&&r.canal===canal&&MESES_ORDER.indexOf(r.mes)>=mesDesde&&MESES_ORDER.indexOf(r.mes)<=mesHasta);
    const t = calcTotals(rows);
    const g = t.v-t.c-t.m;
    return {
      canal, color:CANAL_COLORS[canal]||'#888', icon:CANAL_ICONS[canal]||'📦', ...t, ganancia:g,
      margen:   (!t.v||!isFinite(g/t.v))?'--':((g/t.v)*100).toFixed(1),
      pesoCosto: t.v?((t.c/t.v)*100).toFixed(1):'0',
      pesoMktg:  (!t.v||!isFinite(t.m/t.v))?'--':((t.m/t.v)*100).toFixed(1),
      roasVal:   (!t.m||!isFinite(t.v/t.m))?'--':(t.v/t.m).toFixed(2),
      ventasCurrPromedio: (()=>{
        if (!fechaActualizacion) return null;
        const fecha=new Date(fechaActualizacion);
        const mA=fecha.getMonth(),anA=fecha.getFullYear(),dA=fecha.getDate();
        let dias=0;
        MESES_ORDER.slice(mesDesde,mesHasta+1).forEach(mes=>{
          const mi=MESES_ORDER.indexOf(mes);
          const same=Number(yearCurr)===anA;
          if (!same||mi<mA) dias+=new Date(Number(yearCurr),mi+1,0).getDate();
          else if (same&&mi===mA) dias+=dA;
        });
        return dias>0?Math.round(t.v/dias):null;
      })(),
      ventasPrevPromedio: (()=>{
        if (!fechaActualizacion) return null;
        const fecha=new Date(fechaActualizacion);
        const mA=fecha.getMonth(),anA=fecha.getFullYear(),dA=fecha.getDate();
        let dias=0,vTot=0;
        MESES_ORDER.slice(mesDesde,mesHasta+1).forEach(mes=>{
          const mi=MESES_ORDER.indexOf(mes);
          const same=Number(yearPrev)===anA;
          const dm=new Date(Number(yearPrev),mi+1,0).getDate();
          const rr=rawData.filter((r:Row)=>r.empresa===empresa&&String(r.año)===String(yearPrev)&&r.canal===canal&&r.mes===mes);
          const vm=rr.reduce((a:number,r:Row)=>a+r.ventas,0);
          if (!same||mi<mA){dias+=dm;vTot+=vm;}
          else if (same&&mi===mA){dias+=dA;vTot+=Math.round((vm/dm)*dA);}
        });
        return (dias>0&&vTot>0)?Math.round(vTot/dias):null;
      })(),
    };
  }),[rawData,empresa,yearCurr,yearPrev,canales,mesDesde,mesHasta,fechaActualizacion]);

  const totalVentas = canalTotals.reduce((a,c)=>a+c.v,0);
  const pieData = canalTotals.map(c=>({name:c.canal, value:c.v}));
  const canalChartData = useMemo(()=>{
    if (canalVista==='todos') return rowsCurr.map((d:any)=>{const row:any={month:d.mes};canales.forEach(c=>{row[c]=d.canales[c]?d.canales[c].ventas:0;});return row;});
    return rowsCurr.map((d:any)=>({month:d.mes,ventas:d.canales[canalVista]?.ventas||0,costo:d.canales[canalVista]?.costo||0,marketing:d.canales[canalVista]?.marketing||0}));
  },[rowsCurr,canales,canalVista]);

  const ttip = (content:any) => (
    <Tooltip cursor={{ fill:'transparent' }} content={content} />
  );

  return (
    <>
      {/* Selector empresa + moneda */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {empresas.map((e:string,i:number) => (
            <button key={e} onClick={()=>setEmpIdx(i)} style={{ background:empIdx===i?(empColors[i]||'#6366f1')+'22':'#1e1e2e', border:`2px solid ${empIdx===i?empColors[i]||'#6366f1':'#333'}`, color:empIdx===i?empColors[i]||'#6366f1':'#666', borderRadius:10, padding:'8px 20px', fontSize:13, fontWeight:600, cursor:'pointer' }}>{e}</button>
          ))}
        </div>
        {/* Botón cambio moneda */}
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={()=>setMoneda('USD')} style={{ background:moneda==='USD'?'#6366f122':'#1e1e2e', border:`1px solid ${moneda==='USD'?'#6366f1':'#333'}`, color:moneda==='USD'?'#6366f1':'#666', borderRadius:8, padding:'6px 14px', fontSize:12, cursor:'pointer' }}>💵 USD</button>
          <button onClick={()=>setMoneda('LOCAL')} style={{ background:moneda==='LOCAL'?'#f59e0b22':'#1e1e2e', border:`1px solid ${moneda==='LOCAL'?'#f59e0b':'#333'}`, color:moneda==='LOCAL'?'#f59e0b':'#666', borderRadius:8, padding:'6px 14px', fontSize:12, cursor:'pointer' }}>🏦 Local {moneda==='LOCAL'&&tasaCambio>1?`(×${tasaCambio.toLocaleString("es-CL")})`:''}</button>
        </div>
      </div>

      {/* Selector año + período */}
      <div style={{ background:'#1e1e2e', borderRadius:12, padding:'12px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color:'#888', fontSize:12 }}>Año:</span>
          {years.map((y:string)=>(
            <button key={y} onClick={()=>{setYearCurr(y);const pi=years.indexOf(y);setYearPrev(years[pi-1]||y);}} style={{ background:yearCurr===y?'#6366f133':'transparent', border:`1px solid ${yearCurr===y?'#6366f1':'#333'}`, color:yearCurr===y?'#6366f1':'#555', borderRadius:6, padding:'3px 12px', fontSize:12, cursor:'pointer' }}>{y}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ color:'#888', fontSize:12 }}>Período:</span>
          {MESES_ORDER.map((m,i)=>(
            <button key={i} onClick={()=>{
              if (i===mesDesde&&i===mesHasta){setMesDesde(0);setMesHasta(11);}
              else if (i===mesDesde||i===mesHasta||(i>mesDesde&&i<mesHasta)){setMesDesde(i);setMesHasta(i);}
              else if (i<mesDesde) setMesDesde(i);
              else setMesHasta(i);
            }} style={{ background:i>=mesDesde&&i<=mesHasta?'#6366f133':'transparent', border:`1px solid ${i>=mesDesde&&i<=mesHasta?'#6366f1':'#333'}`, color:i>=mesDesde&&i<=mesHasta?'#6366f1':'#555', borderRadius:6, padding:'3px 8px', fontSize:11, cursor:'pointer' }}>{m}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:12, marginBottom:16 }}>
        <KPI label="Ingresos"      value={fmtConv(tC.v)} sub={`vs ${fmtConv(tP.v)} año ant.`} color={empColor} yoyInfo={yoyLabel(tC.v,tP.v)} />
        <KPI label="Costo producto" value={fmtConv(tC.c)} sub={pct(tC.c,tC.v)+' de ventas'}   color="#f43f5e" yoyInfo={yoyLabel(tC.c,tP.c)} />
        <KPI label="Marketing"      value={fmtConv(tC.m)} sub={pct(tC.m,tC.v)+' de ventas'}   color="#f59e0b" yoyInfo={yoyLabel(tC.m,tP.m)} />
        <KPI label="Ganancia Bruta" value={fmtConv(gC)}   sub={`Margen ${pct(gC,tC.v)}`}      color="#22c55e" yoyInfo={yoyLabel(gC,gP)} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
        <RatioCard label="% Costo / Ventas" value={pct(tC.c,tC.v)} desc="Peso del costo sobre ventas"        color="#f43f5e" />
        <RatioCard label="% Mktg / Ventas"  value={pct(tC.m,tC.v)} desc="Peso del marketing sobre ventas"   color="#f59e0b" />
        <RatioCard label="ROAS"              value={roasFmt(tC.v,tC.m)} desc="Retorno sobre inversión en marketing" color="#a78bfa" />
      </div>

      {/* Canales */}
      <div style={{ marginTop:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
          <h2 style={{ margin:0, fontSize:15, color:'#fff', fontWeight:700 }}>📡 Canales de venta</h2>
          <div style={{ display:'flex', background:'#1e1e2e', borderRadius:10, padding:3, gap:3, flexWrap:'wrap' }}>
            <button onClick={()=>setCanalVista('todos')} style={{ background:canalVista==='todos'?'#6366f1':'transparent', border:'none', color:canalVista==='todos'?'#fff':'#666', borderRadius:7, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>Todos</button>
            {canales.map(c=>(
              <button key={c} onClick={()=>setCanalVista(c)} style={{ background:canalVista===c?CANAL_COLORS[c]||'#888':'transparent', border:'none', color:canalVista===c?'#fff':'#666', borderRadius:7, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>{CANAL_ICONS[c]||'📦'} {c}</button>
            ))}
          </div>
        </div>

        {canalVista==='todos' ? (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:12, marginBottom:16 }}>
              {canalTotals.map(c=>(
                <div key={c.canal} style={{ background:'#1e1e2e', borderRadius:12, padding:'14px 16px', borderLeft:`4px solid ${c.color}` }}>
                  <div style={{ color:c.color, fontSize:13, fontWeight:700, marginBottom:8 }}>{c.icon} {c.canal}</div>
                  <div style={{ color:'#fff', fontSize:18, fontWeight:700 }}>{fmtConv(c.v)}</div>
                  <div style={{ color:'#555', fontSize:11, marginTop:2 }}>Ppto: {fmtConv(c.pv)}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}><span style={{ color:'#888', fontSize:11 }}>Participación</span><span style={{ color:c.color, fontSize:12, fontWeight:700 }}>{pct(c.v,totalVentas)}</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}><span style={{ color:'#888', fontSize:11 }}>ROAS</span><span style={{ color:'#a78bfa', fontSize:12, fontWeight:700 }}>{c.roasVal}x</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}><span style={{ color:'#888', fontSize:11 }}>Margen</span><span style={{ color:'#22c55e', fontSize:12, fontWeight:700 }}>{c.margen}%</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}><span style={{ color:'#888', fontSize:11 }}>Gan. Bruta</span><span style={{ color:'#22c55e', fontSize:12, fontWeight:700 }}>{fmtConv(c.ganancia)}</span></div>
                  {fechaActualizacion && <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}><span style={{ color:'#888', fontSize:11 }}>Prom. día año act.</span><span style={{ color:'#6366f1', fontSize:12, fontWeight:700 }}>{c.ventasCurrPromedio!==null?fmtConv(c.ventasCurrPromedio as number):'$0'}</span></div>}
                  {fechaActualizacion && <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}><span style={{ color:'#888', fontSize:11 }}>Prom. día año ant.</span><span style={{ color:'#6366f1', fontSize:12, fontWeight:700 }}>{c.ventasPrevPromedio!==null?fmtConv(c.ventasPrevPromedio as number):'--'}</span></div>}
                  {c.pv>0 && (
                    <div style={{ marginTop:6 }}>
                      {[{label:'Cumpl. Ventas',real:c.v,ppto:c.pv,inverse:false},{label:'Cumpl. Costo',real:c.c,ppto:c.pc,inverse:true},{label:'Cumpl. Mktg',real:c.m,ppto:c.pm,inverse:true}].map(({label,real,ppto,inverse})=>{
                        const cumpl=ppto>0?(real/ppto)*100:0;
                        const bc=inverse?(cumpl<=100?'#22c55e':cumpl<=110?'#f59e0b':'#f43f5e'):(cumpl>=100?'#22c55e':cumpl>=90?'#f59e0b':'#f43f5e');
                        return (<div key={label} style={{ marginBottom:6 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}><span style={{ color:'#888', fontSize:11 }}>{label}</span><span style={{ color:bc, fontSize:11, fontWeight:700 }}>{ppto>0?cumpl.toFixed(1)+'%':'--'}</span></div>
                          <div style={{ background:'#2a2a3e', borderRadius:4, height:4 }}><div style={{ width:`${Math.min(cumpl,100)}%`, height:'100%', background:bc, borderRadius:4 }} /></div>
                        </div>);
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
              <div style={{ background:'#1e1e2e', borderRadius:12, padding:18 }}>
                <h3 style={{ margin:'0 0 12px', fontSize:13, color:'#ccc' }}>Ventas por canal (mensual)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={canalChartData} barSize={32} style={{ background:'transparent' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
                    <XAxis dataKey="month" stroke="#555" tick={{ fill:'#888', fontSize:11 }} />
                    <YAxis stroke="#555" tick={{ fill:'#888', fontSize:11 }} tickFormatter={fmt} />
                    {ttip(({ active, payload, label }: any) => {
                      if (!active||!payload?.length) return null;
                      return <div style={{ background:"rgba(20,20,35,0.85)", border:"1px solid #333", borderRadius:8, padding:"5px 10px", fontSize:12, pointerEvents:"none" }}>
                        <div style={{ color:"#fff", marginBottom:3, fontWeight:600 }}>{label}</div>
                        {payload.map((p:any,i:number)=><div key={i} style={{ color:p.color, padding:"1px 0" }}>{p.name}: {fmtConv(p.value)}</div>)}
                      </div>;
                    })}
                    <Legend wrapperStyle={{ fontSize:11 }} />
                    {canales.map(c=><Bar key={c} dataKey={c} fill={CANAL_COLORS[c]||'#888'} stackId="a" cursor="" />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background:'#1e1e2e', borderRadius:12, padding:18 }}>
                <h3 style={{ margin:'0 0 12px', fontSize:13, color:'#ccc' }}>Participación de canales</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={0} outerRadius={85} paddingAngle={0} dataKey="value">
                      {canalTotals.map((_,i)=><Cell key={i} fill={canalTotals[i].color} stroke="#13131f" strokeWidth={2} />)}
                    </Pie>
                    <Tooltip content={({ active, payload }: any) => {
                      if (!active||!payload?.length) return null;
                      const p=payload[0];
                      return <div style={{ background:"rgba(20,20,35,0.85)", border:"1px solid #333", borderRadius:8, padding:"5px 10px", fontSize:12, pointerEvents:"none" }}>
                        <div style={{ color:p.payload.fill, fontWeight:600 }}>{p.name}</div>
                        <div style={{ color:"#fff" }}>{fmtConv(p.value)} — {((p.value/totalVentas)*100).toFixed(1)}%</div>
                      </div>;
                    }} />
                    <Legend wrapperStyle={{ fontSize:10, color:'#888' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ background:'#1e1e2e', borderRadius:12, padding:18 }}>
              <h3 style={{ margin:'0 0 12px', fontSize:13, color:'#ccc' }}>Tabla comparativa de canales</h3>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ borderBottom:'1px solid #2a2a3e' }}>
                    {['Canal','Ventas','% Part.','Costo','% Costo','Marketing','% Mktg','Gan_Bruta','Margen','ROAS'].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', color:'#666', textAlign:'center', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {canalTotals.map((c,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid #2a2a3e22', background:i%2===0?'#ffffff05':'transparent' }}>
                        <td style={{ padding:'8px 10px', color:c.color, fontWeight:700 }}>{c.icon} {c.canal}</td>
                        <td style={{ padding:'8px 10px', color:'#fff', textAlign:'center' }}>{fmtConv(c.v)}</td>
                        <td style={{ padding:'8px 10px', color:c.color, textAlign:'center', fontWeight:700 }}>{pct(c.v,totalVentas)}</td>
                        <td style={{ padding:'8px 10px', color:'#f43f5e', textAlign:'center' }}>{fmtConv(c.c)}</td>
                        <td style={{ padding:'8px 10px', color:'#f43f5e', textAlign:'center' }}>{c.pesoCosto}%</td>
                        <td style={{ padding:'8px 10px', color:'#f59e0b', textAlign:'center' }}>{fmtConv(c.m)}</td>
                        <td style={{ padding:'8px 10px', color:'#f59e0b', textAlign:'center' }}>{c.pesoMktg}%</td>
                        <td style={{ padding:'8px 10px', color:'#22c55e', textAlign:'center' }}>{fmtConv(c.ganancia)}</td>
                        <td style={{ padding:'8px 10px', color:'#888', textAlign:'center' }}>{c.margen}%</td>
                        <td style={{ padding:'8px 10px', color:'#a78bfa', textAlign:'center', fontWeight:700 }}>{c.roasVal}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (()=>{
          const ct = canalTotals.find(c=>c.canal===canalVista);
          if (!ct) return null;
          return (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:16 }}>
                <KPI label="Ventas"    value={fmtConv(ct.v)}        sub="Canal seleccionado"    color={ct.color} />
                <KPI label="Costo"     value={fmtConv(ct.c)}        sub={pct(ct.c,ct.v)+' ventas'} color="#f43f5e" />
                <KPI label="Marketing" value={fmtConv(ct.m)}        sub={pct(ct.m,ct.v)+' ventas'} color="#f59e0b" />
                <KPI label="Ganancia"  value={fmtConv(ct.ganancia)} sub={`Margen ${ct.margen}%`}  color="#22c55e" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
                <RatioCard label="% Costo / Ventas" value={`${ct.pesoCosto}%`} desc="Peso del costo"        color="#f43f5e" />
                <RatioCard label="% Mktg / Ventas"  value={`${ct.pesoMktg}%`}  desc="Peso del marketing"   color="#f59e0b" />
                <RatioCard label="ROAS"              value={`${ct.roasVal}x`}   desc="Retorno en marketing" color="#a78bfa" />
              </div>
              <div style={{ background:'#1e1e2e', borderRadius:12, padding:18 }}>
                <h3 style={{ margin:'0 0 12px', fontSize:13, color:'#ccc' }}>Tendencia — {ct.icon} {ct.canal}</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={canalChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
                    <XAxis dataKey="month" stroke="#555" tick={{ fill:'#888', fontSize:11 }} />
                    <YAxis stroke="#555" tick={{ fill:'#888', fontSize:11 }} tickFormatter={fmt} />
                    <Legend wrapperStyle={{ fontSize:11 }} />
                    <Line type="monotone" dataKey="costo"     stroke="#f43f5e"  strokeWidth={2} dot={false} name="Costo" />
                    <Line type="monotone" dataKey="marketing" stroke="#f59e0b"  strokeWidth={2} dot={false} name="Marketing" />
                    <Line type="monotone" dataKey="ventas"    stroke={ct.color} strokeWidth={2} dot={false} name="Ventas" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          );
        })()}
      </div>

      <GraficaYoY rawData={rawData} empresa={empresa} yearCurr={yearCurr} yearPrev={yearPrev} mesDesde={mesDesde} mesHasta={mesHasta} empColor={empColor} />
      <GraficaYoYCanal rawData={rawData} empresa={empresa} yearCurr={yearCurr} yearPrev={yearPrev} mesDesde={mesDesde} mesHasta={mesHasta} />

      {/* Tendencia mensual */}
      <div style={{ background:'#1e1e2e', borderRadius:12, padding:18, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
          <h3 style={{ margin:0, fontSize:13, color:'#ccc' }}>Tendencia mensual</h3>
          <div style={{ display:'flex', gap:6 }}>
            <Toggle label="Ventas" color={METRIC_COLORS.ventas}    active={showV} onClick={()=>setShowV((p:boolean)=>!p)} />
            <Toggle label="Costo"  color={METRIC_COLORS.costo}     active={showC} onClick={()=>setShowC((p:boolean)=>!p)} />
            <Toggle label="Mktg"   color={METRIC_COLORS.marketing} active={showM} onClick={()=>setShowM((p:boolean)=>!p)} />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={rowsCurr}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
            <XAxis dataKey="mes" stroke="#555" tick={{ fill:'#888', fontSize:11 }} />
            <YAxis stroke="#555" tick={{ fill:'#888', fontSize:11 }} tickFormatter={fmt} />
            <Tooltip content={({ active, payload, label }: any) => {
              if (!active||!payload?.length) return null;
              const order=["Ventas","Costo","Marketing"];
              const sorted=[...payload].sort((a,b)=>order.indexOf(a.name)-order.indexOf(b.name));
              return <div style={{ background:"#1e1e2e", border:"1px solid #333", borderRadius:8, padding:"4px 8px", fontSize:12 }}>
                <div style={{ color:"#FFF", marginBottom:2, fontSize:10 }}>{label}</div>
                {sorted.map((p:any,i:number)=><div key={i} style={{ color:p.color, padding:"1px 0" }}>{p.name}: {fmtConv(p.value)}</div>)}
              </div>;
            }} />
            {showV && <Line type="monotone" dataKey="ventas"    stroke={METRIC_COLORS.ventas}    strokeWidth={2} dot={false} name="Ventas" />}
            {showC && <Line type="monotone" dataKey="costo"     stroke={METRIC_COLORS.costo}     strokeWidth={2} dot={false} name="Costo" />}
            {showM && <Line type="monotone" dataKey="marketing" stroke={METRIC_COLORS.marketing} strokeWidth={2} dot={false} name="Marketing" />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Real vs Presupuesto */}
      {tC.pv>0 && (
        <div style={{ marginBottom:16 }}>
          <h2 style={{ margin:'0 0 14px', fontSize:15, color:'#fff', fontWeight:700 }}>🎯 Real vs Presupuesto</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:12, marginBottom:16 }}>
            {[
              { label:'Ventas',   real:tC.v, ppto:tC.pv, color:empColor,   inverse:false },
              { label:'Costo',    real:tC.c, ppto:tC.pc, color:'#f43f5e', inverse:true  },
              { label:'Marketing',real:tC.m, ppto:tC.pm, color:'#f59e0b', inverse:true  },
              { label:'Ganancia', real:gC,   ppto:tC.pv-tC.pc-tC.pm, color:'#22c55e', inverse:false },
            ].map(({ label, real, ppto, color, inverse })=>{
              const varD=real-ppto, varP=ppto>0?((real-ppto)/ppto*100):0;
              const cumpl=ppto>0?Math.min((real/ppto)*100,150):0;
              const bc=inverse?(cumpl<=100?'#22c55e':cumpl<=110?'#f59e0b':'#f43f5e'):(cumpl>=100?'#22c55e':cumpl>=90?'#f59e0b':'#f43f5e');
              return (
                <div key={label} style={{ background:'#1e1e2e', borderRadius:12, padding:'16px 18px', borderLeft:`4px solid ${color}` }}>
                  <div style={{ color:'#888', fontSize:10, textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>{label}</div>
                  <div style={{ color:'#fff', fontSize:18, fontWeight:700 }}>{fmtConv(real)}</div>
                  <div style={{ color:'#555', fontSize:11, marginTop:2 }}>Ppto: {fmtConv(ppto)}</div>
                  <div style={{ display:'flex', gap:8, marginTop:4 }}>
                    <span style={{ color:varD>=0?'#22c55e':'#f43f5e', fontSize:11, fontWeight:600 }}>{varD>=0?'▲':'▼'} {fmtConv(Math.abs(varD))}</span>
                    <span style={{ color:varD>=0?'#22c55e':'#f43f5e', fontSize:11, fontWeight:600 }}>({Math.abs(varP).toFixed(1)}%)</span>
                  </div>
                  <div style={{ marginTop:6 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}><span style={{ color:'#666', fontSize:10 }}>Cumplimiento</span><span style={{ color:bc, fontSize:10, fontWeight:700 }}>{ppto>0?cumpl.toFixed(1):'--'}%</span></div>
                    <div style={{ background:'#2a2a3e', borderRadius:4, height:4 }}><div style={{ width:`${Math.min(cumpl,100)}%`, height:'100%', background:bc, borderRadius:4 }} /></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background:'#1e1e2e', borderRadius:12, padding:18, marginBottom:16 }}>
            <h3 style={{ margin:'0 0 12px', fontSize:13, color:'#ccc' }}>Ventas — Real vs Presupuesto mensual</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={MESES_ORDER.slice(mesDesde,mesHasta+1).map(mes=>{
                const rows=rawData.filter((r:Row)=>r.empresa===empresa&&String(r.año)===String(yearCurr)&&r.mes===mes);
                return { mes, Real:rows.reduce((a:number,r:Row)=>a+r.ventas,0), Presupuesto:rows.reduce((a:number,r:Row)=>a+(r.presupuesto_ventas||0),0) };
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
                <XAxis dataKey="mes" stroke="#555" tick={{ fill:'#888', fontSize:11 }} />
                <YAxis stroke="#555" tick={{ fill:'#888', fontSize:11 }} tickFormatter={fmt} />
                <Tooltip contentStyle={{ background:'#1e1e2e', border:'1px solid #333', borderRadius:8, padding:'4px 8px' }} formatter={(v:any)=>fmtConv(v)} itemStyle={{ fontSize:10 }} labelStyle={{ fontSize:10, color:'#888' }} />
                <Legend wrapperStyle={{ fontSize:11 }} />
                <Line type="monotone" dataKey="Real"        stroke={empColor}  strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="Presupuesto" stroke="#888888"   strokeWidth={1.5} dot={false} strokeDasharray="5 4" opacity={0.8} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background:'#1e1e2e', borderRadius:12, padding:18 }}>
            <h3 style={{ margin:'0 0 12px', fontSize:13, color:'#ccc' }}>Detalle mensual — Real vs Presupuesto</h3>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead><tr style={{ borderBottom:'1px solid #2a2a3e' }}>
                  {['Mes','V.Real','V.Ppto','Cumpl.V','C.Real','C.Ppto','Cumpl.C','M.Real','M.Ppto','Cumpl.M','G.Real','G.Ppto','Cumpl.G'].map(h=>(
                    <th key={h} style={{ padding:'7px 8px', color:'#666', textAlign:'right', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {MESES_ORDER.slice(mesDesde,mesHasta+1).map((mes,i)=>{
                    const rows=rawData.filter((r:Row)=>r.empresa===empresa&&String(r.año)===String(yearCurr)&&r.mes===mes);
                    const rv=rows.reduce((a:number,r:Row)=>a+r.ventas,0);
                    const rc=rows.reduce((a:number,r:Row)=>a+r.costo,0);
                    const rm=rows.reduce((a:number,r:Row)=>a+r.marketing,0);
                    const pv=rows.reduce((a:number,r:Row)=>a+(r.presupuesto_ventas||0),0);
                    const pc=rows.reduce((a:number,r:Row)=>a+(r.presupuesto_costo||0),0);
                    const pm=rows.reduce((a:number,r:Row)=>a+(r.presupuesto_marketing||0),0);
                    const rg=rv-rc-rm, pg=pv-pc-pm;
                    const bc=(r:number,p:number,inv=false)=>{const c=p>0?(r/p)*100:0;return inv?(c<=100?'#22c55e':c<=110?'#f59e0b':'#f43f5e'):(c>=100?'#22c55e':c>=90?'#f59e0b':'#f43f5e');};
                    const cp=(r:number,p:number)=>p>0?`${((r/p)*100).toFixed(1)}%`:'--';
                    return (
                      <tr key={i} style={{ borderBottom:'1px solid #2a2a3e22', background:i%2===0?'#ffffff05':'transparent' }}>
                        <td style={{ padding:'7px 8px', color:'#ccc', fontWeight:600 }}>{mes}</td>
                        <td style={{ padding:'7px 8px', color:'#6366f1', textAlign:'right' }}>{fmtConv(rv)}</td>
                        <td style={{ padding:'7px 8px', color:'#555', textAlign:'right' }}>{fmtConv(pv)}</td>
                        <td style={{ padding:'7px 8px', color:bc(rv,pv), textAlign:'right', fontWeight:700 }}>{cp(rv,pv)}</td>
                        <td style={{ padding:'7px 8px', color:'#f43f5e', textAlign:'right' }}>{fmtConv(rc)}</td>
                        <td style={{ padding:'7px 8px', color:'#555', textAlign:'right' }}>{fmtConv(pc)}</td>
                        <td style={{ padding:'7px 8px', color:bc(rc,pc,true), textAlign:'right', fontWeight:700 }}>{cp(rc,pc)}</td>
                        <td style={{ padding:'7px 8px', color:'#f59e0b', textAlign:'right' }}>{fmtConv(rm)}</td>
                        <td style={{ padding:'7px 8px', color:'#555', textAlign:'right' }}>{fmtConv(pm)}</td>
                        <td style={{ padding:'7px 8px', color:bc(rm,pm,true), textAlign:'right', fontWeight:700 }}>{cp(rm,pm)}</td>
                        <td style={{ padding:'7px 8px', color:rg>=0?'#22c55e':'#f43f5e', textAlign:'right' }}>{fmtConv(rg)}</td>
                        <td style={{ padding:'7px 8px', color:'#555', textAlign:'right' }}>{fmtConv(pg)}</td>
                        <td style={{ padding:'7px 8px', color:bc(rg,pg), textAlign:'right', fontWeight:700 }}>{cp(rg,pg)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop:'2px solid #6366f1', background:'#ffffff08' }}>
                    {(()=>{
                      const all=MESES_ORDER.slice(mesDesde,mesHasta+1).flatMap(mes=>rawData.filter((r:Row)=>r.empresa===empresa&&String(r.año)===String(yearCurr)&&r.mes===mes));
                      const trv=all.reduce((a:number,r:Row)=>a+r.ventas,0);
                      const trc=all.reduce((a:number,r:Row)=>a+r.costo,0);
                      const trm=all.reduce((a:number,r:Row)=>a+r.marketing,0);
                      const tpv=all.reduce((a:number,r:Row)=>a+(r.presupuesto_ventas||0),0);
                      const tpc=all.reduce((a:number,r:Row)=>a+(r.presupuesto_costo||0),0);
                      const tpm=all.reduce((a:number,r:Row)=>a+(r.presupuesto_marketing||0),0);
                      const trg=trv-trc-trm, tpg=tpv-tpc-tpm;
                      const bc=(r:number,p:number,inv=false)=>{const c=p>0?(r/p)*100:0;return inv?(c<=100?'#22c55e':c<=110?'#f59e0b':'#f43f5e'):(c>=100?'#22c55e':c>=90?'#f59e0b':'#f43f5e');};
                      const cp=(r:number,p:number)=>p>0?`${((r/p)*100).toFixed(1)}%`:'--';
                      return <>
                        <td style={{ padding:'7px 8px', color:'#fff', fontWeight:700 }}>Total</td>
                        <td style={{ padding:'7px 8px', color:'#6366f1', textAlign:'right', fontWeight:700 }}>{fmtConv(trv)}</td>
                        <td style={{ padding:'7px 8px', color:'#555', textAlign:'right', fontWeight:700 }}>{fmtConv(tpv)}</td>
                        <td style={{ padding:'7px 8px', color:bc(trv,tpv), textAlign:'right', fontWeight:700 }}>{cp(trv,tpv)}</td>
                        <td style={{ padding:'7px 8px', color:'#f43f5e', textAlign:'right', fontWeight:700 }}>{fmtConv(trc)}</td>
                        <td style={{ padding:'7px 8px', color:'#555', textAlign:'right', fontWeight:700 }}>{fmtConv(tpc)}</td>
                        <td style={{ padding:'7px 8px', color:bc(trc,tpc,true), textAlign:'right', fontWeight:700 }}>{cp(trc,tpc)}</td>
                        <td style={{ padding:'7px 8px', color:'#f59e0b', textAlign:'right', fontWeight:700 }}>{fmtConv(trm)}</td>
                        <td style={{ padding:'7px 8px', color:'#555', textAlign:'right', fontWeight:700 }}>{fmtConv(tpm)}</td>
                        <td style={{ padding:'7px 8px', color:bc(trm,tpm,true), textAlign:'right', fontWeight:700 }}>{cp(trm,tpm)}</td>
                        <td style={{ padding:'7px 8px', color:trg>=0?'#22c55e':'#f43f5e', textAlign:'right', fontWeight:700 }}>{fmtConv(trg)}</td>
                        <td style={{ padding:'7px 8px', color:'#555', textAlign:'right', fontWeight:700 }}>{fmtConv(tpg)}</td>
                        <td style={{ padding:'7px 8px', color:bc(trg,tpg), textAlign:'right', fontWeight:700 }}>{cp(trg,tpg)}</td>
                      </>;
                    })()}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function VistaPresupuesto({ rawData, empresas, years, empColors }: any) {
  const [yearCurr, setYearCurr] = useState(years[years.length-1]);
  const [mesDesde, setMesDesde] = useState(0);
  const [mesHasta, setMesHasta] = useState(11);

  const totals = useMemo(()=>empresas.map((emp:string,i:number)=>{
    const rows=rawData.filter((r:Row)=>r.empresa===emp&&String(r.año)===String(yearCurr)&&MESES_ORDER.indexOf(r.mes)>=mesDesde&&MESES_ORDER.indexOf(r.mes)<=mesHasta);
    const t=calcTotals(rows); const g=t.v-t.c-t.m;
    const varV=t.pv>0?((t.v-t.pv)/t.pv*100):0;
    const varG=t.pv>0?((g-(t.pv-t.pc-t.pm))/Math.abs(t.pv-t.pc-t.pm)*100):0;
    return { emp, color:empColors[i]||'#888', ...t, ganancia:g, gPpto:t.pv-t.pc-t.pm, cumplV:t.pv>0?+((t.v/t.pv)*100).toFixed(1):0, cumplC:t.pc>0?+((t.c/t.pc)*100).toFixed(1):0, cumplM:t.pm>0?+((t.m/t.pm)*100).toFixed(1):0, varV:varV.toFixed(1), varG:varG.toFixed(1), margen:(!t.v||!isFinite(g/t.v))?'--':((g/t.v)*100).toFixed(1) };
  }),[rawData,empresas,yearCurr,years,empColors,mesDesde,mesHasta]);

  const barColor=(p:number)=>p>=100?'#22c55e':p>=80?'#f59e0b':'#f43f5e';
  const PBar=({ value, target }: { value:number; target:number })=>{
    const p=target>0?Math.min((value/target)*100,150):0, bc=barColor(p);
    return <div style={{ marginTop:4 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}><span style={{ color:'#888', fontSize:10 }}>Cumplimiento</span><span style={{ color:bc, fontSize:10, fontWeight:700 }}>{target>0?p.toFixed(1):'--'}%</span></div>
      <div style={{ background:'#2a2a3e', borderRadius:4, height:4 }}><div style={{ width:`${Math.min(p,100)}%`, height:'100%', background:bc, borderRadius:4 }} /></div>
    </div>;
  };

  return (
    <>
      <div style={{ background:'#1e1e2e', borderRadius:12, padding:'12px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color:'#888', fontSize:12 }}>Año:</span>
          {years.map((y:string)=><button key={y} onClick={()=>setYearCurr(y)} style={{ background:yearCurr===y?'#6366f133':'transparent', border:`1px solid ${yearCurr===y?'#6366f1':'#333'}`, color:yearCurr===y?'#6366f1':'#555', borderRadius:6, padding:'3px 12px', fontSize:12, cursor:'pointer' }}>{y}</button>)}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ color:'#888', fontSize:12 }}>Período:</span>
          {MESES_ORDER.map((m,i)=>(
            <button key={i} onClick={()=>{
              if (i===mesDesde&&i===mesHasta){setMesDesde(0);setMesHasta(11);}
              else if (i===mesDesde||i===mesHasta||(i>mesDesde&&i<mesHasta)){setMesDesde(i);setMesHasta(i);}
              else if (i<mesDesde) setMesDesde(i);
              else setMesHasta(i);
            }} style={{ background:i>=mesDesde&&i<=mesHasta?'#6366f133':'transparent', border:`1px solid ${i>=mesDesde&&i<=mesHasta?'#6366f1':'#333'}`, color:i>=mesDesde&&i<=mesHasta?'#6366f1':'#555', borderRadius:6, padding:'3px 8px', fontSize:11, cursor:'pointer' }}>{m}</button>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:14, marginBottom:20 }}>
        {totals.map((e:any)=>(
          <div key={e.emp} style={{ background:'#1e1e2e', borderRadius:12, padding:'16px 18px', borderLeft:`4px solid ${e.color}` }}>
            <div style={{ color:e.color, fontSize:13, fontWeight:700, marginBottom:10 }}>{e.emp}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div><div style={{ color:'#666', fontSize:10, textTransform:'uppercase' }}>Ventas</div><div style={{ color:'#fff', fontSize:14, fontWeight:700 }}>{fmtFull(e.v)}</div><div style={{ color:'#555', fontSize:10 }}>Ppto: {fmtFull(e.pv)}</div><div style={{ color:Number(e.varV)>=0?'#22c55e':'#f43f5e', fontSize:10, fontWeight:600 }}>{Number(e.varV)>=0?'▲':'▼'} {Math.abs(Number(e.varV))}%</div><PBar value={e.v} target={e.pv} /></div>
              <div><div style={{ color:'#666', fontSize:10, textTransform:'uppercase' }}>Ganancia</div><div style={{ color:'#22c55e', fontSize:14, fontWeight:700 }}>{fmtFull(e.ganancia)}</div><div style={{ color:'#555', fontSize:10 }}>Ppto: {fmtFull(e.gPpto)}</div><div style={{ color:Number(e.varG)>=0?'#22c55e':'#f43f5e', fontSize:10, fontWeight:600 }}>{Number(e.varG)>=0?'▲':'▼'} {Math.abs(Number(e.varG))}%</div></div>
              <div><div style={{ color:'#666', fontSize:10, textTransform:'uppercase' }}>Costo</div><div style={{ color:'#f43f5e', fontSize:13, fontWeight:600 }}>{fmtFull(e.c)}</div><div style={{ color:'#555', fontSize:10 }}>Ppto: {fmtFull(e.pc)}</div><PBar value={e.c} target={e.pc} /></div>
              <div><div style={{ color:'#666', fontSize:10, textTransform:'uppercase' }}>Marketing</div><div style={{ color:'#f59e0b', fontSize:13, fontWeight:600 }}>{fmtFull(e.m)}</div><div style={{ color:'#555', fontSize:10 }}>Ppto: {fmtFull(e.pm)}</div><PBar value={e.m} target={e.pm} /></div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background:'#1e1e2e', borderRadius:12, padding:18 }}>
        <h3 style={{ margin:'0 0 14px', fontSize:14, color:'#ccc' }}>Resumen Real vs Presupuesto</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr style={{ borderBottom:'1px solid #2a2a3e' }}>
              {['Empresa','Ventas Real','Ppto Ventas','Cumpl.','Costo Real','Ppto Costo','Cumpl.','Mktg Real','Ppto Mktg','Cumpl.','Ganancia','Ppto Gan.','Margen'].map(h=>(
                <th key={h} style={{ padding:'8px 10px', color:'#666', textAlign:'right', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {totals.map((e:any,i:number)=>(
                <tr key={i} style={{ borderBottom:'1px solid #2a2a3e22' }}>
                  <td style={{ padding:'8px 10px', color:e.color, fontWeight:700 }}>{e.emp}</td>
                  <td style={{ padding:'8px 10px', color:'#6366f1', textAlign:'right' }}>{fmtFull(e.v)}</td>
                  <td style={{ padding:'8px 10px', color:'#555', textAlign:'right' }}>{fmtFull(e.pv)}</td>
                  <td style={{ padding:'8px 10px', color:barColor(e.cumplV), textAlign:'right', fontWeight:700 }}>{e.cumplV}%</td>
                  <td style={{ padding:'8px 10px', color:'#f43f5e', textAlign:'right' }}>{fmtFull(e.c)}</td>
                  <td style={{ padding:'8px 10px', color:'#555', textAlign:'right' }}>{fmtFull(e.pc)}</td>
                  <td style={{ padding:'8px 10px', color:barColor(e.cumplC), textAlign:'right', fontWeight:700 }}>{e.cumplC}%</td>
                  <td style={{ padding:'8px 10px', color:'#f59e0b', textAlign:'right' }}>{fmtFull(e.m)}</td>
                  <td style={{ padding:'8px 10px', color:'#555', textAlign:'right' }}>{fmtFull(e.pm)}</td>
                  <td style={{ padding:'8px 10px', color:barColor(e.cumplM), textAlign:'right', fontWeight:700 }}>{e.cumplM}%</td>
                  <td style={{ padding:'8px 10px', color:'#22c55e', textAlign:'right' }}>{fmtFull(e.ganancia)}</td>
                  <td style={{ padding:'8px 10px', color:'#555', textAlign:'right' }}>{fmtFull(e.gPpto)}</td>
                  <td style={{ padding:'8px 10px', color:'#888', textAlign:'right' }}>{e.margen}%</td>
                </tr>
              ))}
              <tr style={{ borderTop:'2px solid #6366f1', background:'#ffffff08' }}>
                <td style={{ padding:'8px 10px', color:'#fff', fontWeight:700 }}>Total</td>
                <td style={{ padding:'8px 10px', color:'#6366f1', textAlign:'right', fontWeight:700 }}>{fmtFull(totals.reduce((a:number,e:any)=>a+e.v,0))}</td>
                <td style={{ padding:'8px 10px', color:'#555', textAlign:'right', fontWeight:700 }}>{fmtFull(totals.reduce((a:number,e:any)=>a+e.pv,0))}</td>
                <td style={{ padding:'8px 10px', color:barColor(totals.reduce((a:number,e:any)=>a+e.v,0)/totals.reduce((a:number,e:any)=>a+e.pv,0)*100), textAlign:'right', fontWeight:700 }}>{(totals.reduce((a:number,e:any)=>a+e.v,0)/totals.reduce((a:number,e:any)=>a+e.pv,0)*100).toFixed(1)}%</td>
                <td style={{ padding:'8px 10px', color:'#f43f5e', textAlign:'right', fontWeight:700 }}>{fmtFull(totals.reduce((a:number,e:any)=>a+e.c,0))}</td>
                <td style={{ padding:'8px 10px', color:'#555', textAlign:'right', fontWeight:700 }}>{fmtFull(totals.reduce((a:number,e:any)=>a+e.pc,0))}</td>
                <td style={{ padding:'8px 10px', color:barColor(totals.reduce((a:number,e:any)=>a+e.c,0)/totals.reduce((a:number,e:any)=>a+e.pc,0)*100), textAlign:'right', fontWeight:700 }}>{(totals.reduce((a:number,e:any)=>a+e.c,0)/totals.reduce((a:number,e:any)=>a+e.pc,0)*100).toFixed(1)}%</td>
                <td style={{ padding:'8px 10px', color:'#f59e0b', textAlign:'right', fontWeight:700 }}>{fmtFull(totals.reduce((a:number,e:any)=>a+e.m,0))}</td>
                <td style={{ padding:'8px 10px', color:'#555', textAlign:'right', fontWeight:700 }}>{fmtFull(totals.reduce((a:number,e:any)=>a+e.pm,0))}</td>
                <td style={{ padding:'8px 10px', color:barColor(totals.reduce((a:number,e:any)=>a+e.m,0)/totals.reduce((a:number,e:any)=>a+e.pm,0)*100), textAlign:'right', fontWeight:700 }}>{(totals.reduce((a:number,e:any)=>a+e.m,0)/totals.reduce((a:number,e:any)=>a+e.pm,0)*100).toFixed(1)}%</td>
                <td style={{ padding:'8px 10px', color:'#22c55e', textAlign:'right', fontWeight:700 }}>{fmtFull(totals.reduce((a:number,e:any)=>a+e.ganancia,0))}</td>
                <td style={{ padding:'8px 10px', color:'#555', textAlign:'right', fontWeight:700 }}>{fmtFull(totals.reduce((a:number,e:any)=>a+e.gPpto,0))}</td>
                <td style={{ padding:'8px 10px', color:'#888', textAlign:'right', fontWeight:700 }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── VISTA COMPARATIVA ─────────────────────────────────────────────
function VistaComparativa({ rawData, empresas, years, empColors }: any) {
  const [yearCurr, setYearCurr] = useState(years[years.length-1]);
  const [metric, setMetric] = useState('ventas');
  const [mesDesde, setMesDesde] = useState(0);
const [mesHasta, setMesHasta] = useState(11);

  const totals = useMemo(()=>empresas.map((emp:string,i:number)=>{
   const rC = rawData.filter(
          (r: Row) => r.empresa === emp && String(r.año) === String(yearCurr) && MESES_ORDER.indexOf(r.mes) >= mesDesde && MESES_ORDER.indexOf(r.mes) <= mesHasta
        );
    const rP = rawData.filter(
          (r: Row) => r.empresa === emp && String(r.año) === String(years[years.indexOf(yearCurr) - 1] || yearCurr) && MESES_ORDER.indexOf(r.mes) >= mesDesde && MESES_ORDER.indexOf(r.mes) <= mesHasta
        );
    const t=calcTotals(rC),tP=calcTotals(rP);
    const g=t.v-t.c-t.m,gP=tP.v-tP.c-tP.m;
    return { emp, color:empColors[i]||'#888', ...t, ganancia:g, margen:(!t.v||!isFinite(g/t.v))?'--':((g/t.v)*100).toFixed(1), pesoCosto:((t.c/t.v)*100).toFixed(1), pesoMktg:(!t.v||!isFinite(t.m/t.v))?'--':((t.m/t.v)*100).toFixed(1), roasVal:(!t.m||!isFinite(t.v/t.m))?'--':(t.v/t.m).toFixed(2), yoyV:yoyLabel(t.v,tP.v), yoyG:yoyLabel(g,gP) };
  }),[rawData,empresas,yearCurr,years,empColors,mesDesde,mesHasta]);

  const lineData = useMemo(()=>MESES_ORDER.slice(mesDesde, mesHasta+1).map(mes=>{
    const row:any={month:mes};
    empresas.forEach((emp:string)=>{
      const r=rawData.filter((d:Row)=>d.empresa===emp&&d.año===String(yearCurr)&&d.mes===mes);
      row[emp]=r.reduce((a:number,d:Row)=>a+(metric==='ventas'?d.ventas:metric==='costo'?d.costo:d.marketing),0);
    });
    return row;
  }),[rawData,empresas,yearCurr,metric,mesDesde,mesHasta]);

  const CANALES_ORDER=["Shopify","Marketplaces","B2B","Tiendas"];
  const canales=CANALES_ORDER.filter(c=>rawData.some((r:Row)=>r.canal===c));
  const canalEmpData = useMemo(()=>canales.map(canal=>{
    const row:any={canal};
    empresas.forEach((emp:string)=>{
      row[emp]=rawData.filter((d:Row)=>d.empresa===emp&&d.año===String(yearCurr)&&d.canal===canal&&MESES_ORDER.indexOf(d.mes)>=mesDesde&&MESES_ORDER.indexOf(d.mes)<=mesHasta).reduce((a:number,d:Row)=>a+d.ventas,0);
    });
    return row;
  }),[rawData,empresas,yearCurr,canales,mesDesde,mesHasta]);

  const ttipGlass = ({ active, payload, label }: any) => {
    if (!active||!payload?.length) return null;
    return <div style={{ background:"rgba(20,20,35,0.85)", border:"1px solid #333", borderRadius:8, padding:"5px 10px", fontSize:12, pointerEvents:"none" }}>
      <div style={{ color:"#fff", marginBottom:3, fontWeight:600 }}>{label}</div>
      {payload.map((p:any,i:number)=><div key={i} style={{ color:p.color, padding:"1px 0" }}>{p.name}: {fmtFull(p.value)}</div>)}
    </div>;
  };

  return (
    <>
      <div style={{ background:'#1e1e2e', borderRadius:12, padding:'12px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color:'#888', fontSize:12 }}>Año:</span>
          {years.map((y:string)=><button key={y} onClick={()=>setYearCurr(y)} style={{ background:yearCurr===y?'#6366f133':'transparent', border:`1px solid ${yearCurr===y?'#6366f1':'#333'}`, color:yearCurr===y?'#6366f1':'#555', borderRadius:6, padding:'3px 12px', fontSize:12, cursor:'pointer' }}>{y}</button>)}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ color:'#888', fontSize:12 }}>Período:</span>
          {MESES_ORDER.map((m,i)=>(
            <button key={i} onClick={()=>{
              if (i===mesDesde&&i===mesHasta){setMesDesde(0);setMesHasta(11);}
              else if (i===mesDesde||i===mesHasta||(i>mesDesde&&i<mesHasta)){setMesDesde(i);setMesHasta(i);}
              else if (i<mesDesde) setMesDesde(i);
              else setMesHasta(i);
            }} style={{ background:i>=mesDesde&&i<=mesHasta?'#6366f133':'transparent', border:`1px solid ${i>=mesDesde&&i<=mesHasta?'#6366f1':'#333'}`, color:i>=mesDesde&&i<=mesHasta?'#6366f1':'#555', borderRadius:6, padding:'3px 8px', fontSize:11, cursor:'pointer' }}>{m}</button>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:12, marginBottom:18 }}>
        {totals.map((e:any)=>(
          <div key={e.emp} style={{ background:'#1e1e2e', borderRadius:12, padding:'14px 16px', borderLeft:`4px solid ${e.color}` }}>
            <div style={{ color:e.color, fontSize:13, fontWeight:700, marginBottom:10 }}>{e.emp}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              <div><div style={{ color:'#666', fontSize:12, textTransform:'uppercase' }}>Ventas</div><div style={{ color:'#fff', fontSize:13, fontWeight:600 }}>{fmtFull(e.v)}</div>{e.yoyV&&<div style={{ color:e.yoyV.positive?'#22c55e':'#f43f5e', fontSize:12, fontWeight:600 }}>{e.yoyV.val}</div>}</div>
              <div><div style={{ color:'#666', fontSize:12, textTransform:'uppercase' }}>Ganancia</div><div style={{ color:'#22c55e', fontSize:13, fontWeight:600 }}>{fmtFull(e.ganancia)}</div>{e.yoyG&&<div style={{ color:e.yoyG.positive?'#22c55e':'#f43f5e', fontSize:12, fontWeight:600 }}>{e.yoyG.val}</div>}</div>
              <div><div style={{ color:'#666', fontSize:12, textTransform:'uppercase' }}>% Costo</div><div style={{ color:'#f43f5e', fontSize:13, fontWeight:600 }}>{e.pesoCosto}%</div></div>
              <div><div style={{ color:'#666', fontSize:12, textTransform:'uppercase' }}>% Mktg</div><div style={{ color:'#f59e0b', fontSize:13, fontWeight:600 }}>{e.pesoMktg}%</div></div>
              <div><div style={{ color:'#666', fontSize:12, textTransform:'uppercase' }}>Margen</div><div style={{ color:'#888', fontSize:13, fontWeight:600 }}>{e.margen}%</div></div>
              <div><div style={{ color:'#666', fontSize:12, textTransform:'uppercase' }}>ROAS</div><div style={{ color:'#a78bfa', fontSize:13, fontWeight:700 }}>{e.roasVal}x</div></div>
            </div>
          </div>
        ))}
      </div>

      {/* 4 gráficos distribución */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:16 }}>
        {([{label:'Distribución Ventas',key:'v'},{label:'Distribución Costo',key:'c'},{label:'Distribución Marketing',key:'m'},{label:'Distribución Margen Bruto',key:'ganancia'}] as const).map(({label,key})=>{
          const pd=totals.map((e:any)=>({name:e.emp,value:key==='ganancia'?Math.max(e.ganancia,0):e[key],color:e.color}));
          const tot=pd.reduce((a:number,d:any)=>a+d.value,0);
          return (
            <div key={label} style={{ background:'#1e1e2e', borderRadius:12, padding:16 }}>
              <h3 style={{ margin:'0 0 10px', fontSize:12, color:'#ccc', textAlign:'center' }}>{label}</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pd} cx="50%" cy="50%" innerRadius={0} outerRadius={55} paddingAngle={0} dataKey="value"
                    label={({ value, cx, cy, midAngle, innerRadius, outerRadius }: any)=>{
                      if (!tot||((value/tot)*100)<=5) return null;
                      const R=Math.PI/180, r=innerRadius+(outerRadius-innerRadius)*0.5;
                      return <text x={cx+r*Math.cos(-midAngle*R)} y={cy+r*Math.sin(-midAngle*R)} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={9}>{`${((value/tot)*100).toFixed(1)}%`}</text>;
                    }} labelLine={false}>
                    {pd.map((d:any,i:number)=><Cell key={i} fill={d.color} stroke="#13131f" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background:'#1e1e2e', border:'1px solid #333', borderRadius:8, padding:'4px 8px' }} formatter={(v:any,name:any)=>[`${fmtFull(v)} (${tot>0?((v/tot)*100).toFixed(1):0}%)`,name]} itemStyle={{ fontSize:10 }} labelStyle={{ fontSize:10, color:'#888' }} />
                  <Legend wrapperStyle={{ fontSize:10, color:'#888' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>

      <div style={{ background:'#1e1e2e', borderRadius:12, padding:18, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
          <h3 style={{ margin:0, fontSize:13, color:'#ccc' }}>Comparativa entre empresas</h3>
          <div style={{ display:'flex', gap:6 }}>
            {(['ventas','costo','marketing'] as const).map(k=><Toggle key={k} label={k.charAt(0).toUpperCase()+k.slice(1)} color={METRIC_COLORS[k]} active={metric===k} onClick={()=>setMetric(k)} />)}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
            <XAxis dataKey="month" stroke="#555" tick={{ fill:'#888', fontSize:11 }} />
            <YAxis stroke="#555" tick={{ fill:'#888', fontSize:11 }} tickFormatter={fmt} />
            <Tooltip cursor={{ fill:'transparent' }} content={ttipGlass} />
            <Legend wrapperStyle={{ fontSize:12 }} />
            {empresas.map((e:string,i:number)=><Line key={e} type="monotone" dataKey={e} stroke={empColors[i]||'#888'} strokeWidth={2} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background:'#1e1e2e', borderRadius:12, padding:18, marginBottom:16 }}>
        <h3 style={{ margin:'0 0 12px', fontSize:13, color:'#ccc' }}>Ventas por canal — comparativa</h3>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={canalEmpData} barSize={18} style={{ background:'transparent' }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
            <XAxis dataKey="canal" stroke="#555" tick={{ fill:'#888', fontSize:11 }} />
            <YAxis stroke="#555" tick={{ fill:'#888', fontSize:11 }} tickFormatter={fmt} />
            <Tooltip cursor={{ fill:'transparent' }} content={ttipGlass} />
            <Legend wrapperStyle={{ fontSize:12 }} />
            {empresas.map((e:string,i:number)=><Bar key={e} dataKey={e} fill={empColors[i]||'#888'} radius={[4,4,0,0]} cursor="" />)}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background:'#1e1e2e', borderRadius:12, padding:18 }}>
        <h3 style={{ margin:'0 0 12px', fontSize:13, color:'#ccc' }}>Resumen consolidado</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr style={{ borderBottom:'1px solid #2a2a3e' }}>
              {['Empresa','Ventas','YoY','Costo','% Costo','Marketing','% Mktg','Gan_Bruta','YoY','Margen','ROAS'].map(h=>(
                <th key={h} style={{ padding:'8px 10px', color:'#666', textAlign:'center', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {totals.map((e:any,i:number)=>(
                <tr key={i} style={{ borderBottom:'1px solid #2a2a3e22' }}>
                  <td style={{ padding:'8px 10px', color:e.color, fontWeight:700 }}>{e.emp}</td>
                  <td style={{ padding:'8px 10px', color:METRIC_COLORS.ventas, textAlign:'center' }}>{fmtFull(e.v)}</td>
                  <td style={{ padding:'8px 10px', textAlign:'center', color:e.yoyV?.positive?'#22c55e':'#f43f5e', fontWeight:600 }}>{e.yoyV?.val||'—'}</td>
                  <td style={{ padding:'8px 10px', color:METRIC_COLORS.costo, textAlign:'center' }}>{fmtFull(e.c)}</td>
                  <td style={{ padding:'8px 10px', color:'#f43f5e', textAlign:'center' }}>{e.pesoCosto}%</td>
                  <td style={{ padding:'8px 10px', color:METRIC_COLORS.marketing, textAlign:'center' }}>{fmtFull(e.m)}</td>
                  <td style={{ padding:'8px 10px', color:'#f59e0b', textAlign:'center' }}>{e.pesoMktg}%</td>
                  <td style={{ padding:'8px 10px', color:'#22c55e', textAlign:'center' }}>{fmtFull(e.ganancia)}</td>
                  <td style={{ padding:'8px 10px', textAlign:'center', color:e.yoyG?.positive?'#22c55e':'#f43f5e', fontWeight:600 }}>{e.yoyG?.val||'—'}</td>
                  <td style={{ padding:'8px 10px', color:'#888', textAlign:'center' }}>{e.margen}%</td>
                  <td style={{ padding:'8px 10px', color:'#a78bfa', textAlign:'center', fontWeight:700 }}>{e.roasVal}x</td>
                </tr>
              ))}
              <tr style={{ borderTop:"2px solid #6366f1", background:"#ffffff08" }}>
                <td style={{ padding:"8px 10px", color:"#fff", fontWeight:700 }}>Total</td>
                <td style={{ padding:"8px 10px", color:METRIC_COLORS.ventas, textAlign:"center", fontWeight:700 }}>{fmtFull(totals.reduce((a:number,e:any)=>a+e.v,0))}</td>
                <td style={{ padding:"8px 10px", textAlign:"center" }}>—</td>
                <td style={{ padding:"8px 10px", color:METRIC_COLORS.costo, textAlign:"center", fontWeight:700 }}>{fmtFull(totals.reduce((a:number,e:any)=>a+e.c,0))}</td>
                <td style={{ padding:"8px 10px", color:"#f43f5e", textAlign:"center", fontWeight:700 }}>{pct(totals.reduce((a:number,e:any)=>a+e.c,0),totals.reduce((a:number,e:any)=>a+e.v,0))}</td>
                <td style={{ padding:"8px 10px", color:METRIC_COLORS.marketing, textAlign:"center", fontWeight:700 }}>{fmtFull(totals.reduce((a:number,e:any)=>a+e.m,0))}</td>
                <td style={{ padding:"8px 10px", color:"#f59e0b", textAlign:"center", fontWeight:700 }}>{pct(totals.reduce((a:number,e:any)=>a+e.m,0),totals.reduce((a:number,e:any)=>a+e.v,0))}</td>
                <td style={{ padding:"8px 10px", color:"#22c55e", textAlign:"center", fontWeight:700 }}>{fmtFull(totals.reduce((a:number,e:any)=>a+e.ganancia,0))}</td>
                <td style={{ padding:"8px 10px", textAlign:"center" }}>—</td>
                <td style={{ padding:"8px 10px", color:"#888", textAlign:"center", fontWeight:700 }}>{pct(totals.reduce((a:number,e:any)=>a+e.ganancia,0),totals.reduce((a:number,e:any)=>a+e.v,0))}</td>
                <td style={{ padding:"8px 10px", textAlign:"center" }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── DASHBOARD PRINCIPAL ───────────────────────────────────────────
export default function Dashboard() {
  const [modo, setModo] = useState('individual');
  const [rawData, setRawData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [lastUpdate, setLastUpdate] = useState<string|null>(null);
  const [fechaActualizacion, setFechaActualizacion] = useState<string|null>(null);
  const [tipoCambioData, setTipoCambioData] = useState<any[]>([]);
  const [moneda, setMoneda] = useState<'USD'|'LOCAL'>('USD');

  const fetchData = () => {
    setLoading(true); setError(null);
    const cbName = 'dashboardCallback_'+Date.now();
    const script = document.createElement('script');
    (window as any)[cbName] = (response: any) => {
      try {
        const json  = Array.isArray(response)?response:(response.datos||response);
        const tcRaw = Array.isArray(response)?[]:(response.tipoCambio||[]);
        const tiposCambio = tcRaw.map((obj:any)=>{
          const cl:any={};
          Object.keys(obj).forEach(k=>{cl[k.trim().toLowerCase()]=obj[k];});
          return { año:String(cl['año']||''), mes:String(cl['mes']||''), empresa:String(cl['empresa']||''), tasa:parseFloat(cl['tipo_cambio']||cl['tasa']||1) };
        });
        setTipoCambioData(tiposCambio);

        const filaFecha = json.find((obj:any)=>{
          const cl:any={};Object.keys(obj).forEach(k=>{cl[k.trim().toLowerCase()]=obj[k];});
          return String(cl['año']||cl['ano']||'').toLowerCase()==='ultima_actualizacion';
        });
        if (filaFecha){const cl:any={};Object.keys(filaFecha).forEach(k=>{cl[k.trim().toLowerCase()]=filaFecha[k];});setFechaActualizacion(String(cl['mes']||''));}

        const rows: Row[] = json.map((obj:any)=>{
          const cl:any={};Object.keys(obj).forEach(k=>{cl[k.trim().toLowerCase()]=obj[k];});
          return { año:String(cl['año']||cl['ano']||cl['year']||''), mes:String(cl['mes']||cl['month']||''), empresa:String(cl['empresa']||cl['company']||''), canal:String(cl['canal']||cl['channel']||''), ventas:parseFloat(cl['ventas'])||0, costo:parseFloat(cl['costo'])||0, marketing:parseFloat(cl['marketing'])||0, presupuesto_ventas:parseFloat(cl['presupuesto_ventas'])||0, presupuesto_costo:parseFloat(cl['presupuesto_costo'])||0, presupuesto_marketing:parseFloat(cl['presupuesto_marketing'])||0 };
        }).filter((r:Row)=>r.empresa&&r.mes&&String(r.año)&&String(r.año).toLowerCase()!=='ultima_actualizacion');
        setRawData(rows);
        setLastUpdate(new Date().toLocaleTimeString());
      } catch(e:any){ setError(e.message); }
      finally { setLoading(false); delete (window as any)[cbName]; document.body.removeChild(script); }
    };
    script.onerror=()=>{ setError('No se pudo conectar con Google Sheets'); setLoading(false); delete (window as any)[cbName]; };
    script.src=`${SHEET_URL}?callback=${cbName}&t=${Date.now()}`;
    document.body.appendChild(script);
  };

  useEffect(()=>{fetchData();},[]);

  const empresas = useMemo(
    () => [...new Set(rawData.map((r) => r.empresa))].sort().filter((e: string) => e !== 'eCompany'),[rawData]);
  const years     = useMemo(()=>[...new Set(rawData.map(r=>String(r.año)))].sort(),[rawData]);
  const empColors = useMemo(()=>empresas.map((_,i)=>EMP_COLORS[i%EMP_COLORS.length]),[empresas]);

  return (
    <div style={{ background:'#13131f', color:'#fff', fontFamily:'Inter, sans-serif', minHeight:'100vh', padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>📊 Dashboard del Grupo</h1>
          <p style={{ margin:'4px 0 0', color:'#666', fontSize:13 }}>
            Ventas · Costos · Marketing · Canales · YoY
            {lastUpdate && <span style={{ marginLeft:12, color:'#444' }}>· Actualizado {lastUpdate} {fechaActualizacion&&`· Datos al ${fechaActualizacion}`}</span>}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={fetchData} style={{ background:'#1e1e2e', border:'1px solid #333', color:'#888', borderRadius:8, padding:'8px 14px', fontSize:12, cursor:'pointer' }}>🔄 Actualizar</button>
          <div style={{ display:'flex', background:'#1e1e2e', borderRadius:10, padding:4, gap:4 }}>
            {[['individual','Por empresa'],['comparativa','Comparar todas'],['presupuesto','vs Presupuesto']].map(([v,lbl])=>(
              <button key={v} onClick={()=>setModo(v)} style={{ background:modo===v?'#6366f1':'transparent', border:'none', color:modo===v?'#fff':'#666', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer' }}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div style={{ textAlign:'center', padding:80, color:'#666' }}><div style={{ fontSize:32, marginBottom:12 }}>⏳</div><div>Cargando datos desde Google Sheets...</div></div>}
      {error && <div style={{ background:'#2a1a1a', border:'1px solid #f43f5e44', borderRadius:12, padding:24, textAlign:'center', color:'#f43f5e' }}><div style={{ fontSize:24, marginBottom:8 }}>⚠️</div><div style={{ fontWeight:600 }}>Error al cargar los datos</div><div style={{ color:'#888', fontSize:13, marginTop:4 }}>{error}</div><button onClick={fetchData} style={{ marginTop:16, background:'#f43f5e22', border:'1px solid #f43f5e', color:'#f43f5e', borderRadius:8, padding:'8px 20px', cursor:'pointer' }}>Reintentar</button></div>}
      {!loading&&!error&&rawData.length===0 && <div style={{ textAlign:'center', padding:80, color:'#666' }}><div style={{ fontSize:32, marginBottom:12 }}>📭</div><div>No se encontraron datos en el Google Sheet.</div></div>}

      {!loading&&!error&&rawData.length>0&&empresas.length>0&&years.length>0&&(
        modo==='individual' ? (
          <VistaIndividual rawData={rawData} empresas={empresas} years={years} empColors={empColors} fechaActualizacion={fechaActualizacion} tipoCambioData={tipoCambioData} moneda={moneda} setMoneda={setMoneda} />
        ) : modo==='comparativa' ? (
          <VistaComparativa rawData={rawData} empresas={empresas} years={years} empColors={empColors} />
        ) : (
          <VistaPresupuesto rawData={rawData} empresas={empresas} years={years} empColors={empColors} />
        )
      )}
    </div>
  );
}

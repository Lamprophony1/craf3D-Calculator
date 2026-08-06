import { useEffect, useState } from 'react';
import { get, post } from '../api/client';
import { JsonCard } from './ResourceScreens';

const reportEndpoints = [
  ['Resumen', 'summary'], ['Rentabilidad', 'profitability'], ['Estimado vs. real', 'estimate-vs-actual'],
  ['Materiales', 'material-consumption'], ['Uso de impresoras', 'printer-utilization'], ['Calibración energética', 'energy-calibration']
] as const;

export function ReportsScreen() {
  const [report, setReport] = useState('summary'); const [data, setData] = useState<unknown>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { get(`/api/reports/${report}`).then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error')); }, [report]);
  const exportCsv = () => {
    const rows = Array.isArray(data) ? data as Record<string, unknown>[] : [data as Record<string, unknown>];
    if (!rows[0]) return; const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(row => headers.map(key => `"${String(row[key] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = `printcost-${report}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  return <section className="page"><div className="page-heading"><div><h1>Reportes</h1><p>Rentabilidad y calibración a partir de trabajos reales.</p></div><button className="secondary" onClick={exportCsv}>Exportar CSV</button></div>
    <div className="tabs">{reportEndpoints.map(([label,key])=><button key={key} className={report===key?'active secondary':'secondary'} onClick={()=>setReport(key)}>{label}</button>)}</div>
    {error?<p className="error">{error}</p>:null}{data?<JsonCard data={data}/>:<p>Cargando…</p>}</section>;
}

export function AuditScreen() {
  const [data,setData]=useState<unknown>(null); const [error,setError]=useState<string|null>(null);
  useEffect(()=>{get('/api/audit?take=200').then(setData).catch((e:unknown)=>setError(e instanceof Error?e.message:'Error'));},[]);
  return <section className="page"><div className="page-heading"><div><h1>Auditoría</h1><p>Operaciones sensibles y cambios de estado.</p></div></div>{error?<p className="error">{error}</p>:null}{data?<JsonCard data={data}/>:<p>Cargando…</p>}</section>;
}

export function ProfileScreen() {
  const [currentPin,setCurrentPin]=useState(''); const [newPin,setNewPin]=useState(''); const [message,setMessage]=useState<string|null>(null);
  return <section className="page"><div className="page-heading"><div><h1>Perfil y seguridad</h1><p>Cambio de PIN propio.</p></div></div><form className="card form-grid compact" onSubmit={async e=>{e.preventDefault();try{await post('/api/auth/change-pin',{currentPin,newPin});setCurrentPin('');setNewPin('');setMessage('PIN actualizado.');}catch(reason){setMessage(reason instanceof Error?reason.message:'Error');}}}>
    <label>PIN actual<input type="password" inputMode="numeric" minLength={4} maxLength={6} value={currentPin} onChange={e=>setCurrentPin(e.target.value.replace(/\D/g,''))} required/></label>
    <label>PIN nuevo<input type="password" inputMode="numeric" minLength={4} maxLength={6} value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\D/g,''))} required/></label>
    {message?<p role="status" className={message.includes('actualizado')?'success':'error'}>{message}</p>:null}<div className="actions span-2"><button>Actualizar PIN</button></div></form></section>;
}


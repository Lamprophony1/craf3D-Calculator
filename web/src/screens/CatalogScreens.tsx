import { useEffect, useState } from 'react';
import { get, post } from '../api/client';

interface Field { name: string; label: string; type?: 'text' | 'number' | 'date' | 'select'; required?: boolean; options?: string[]; defaultValue?: string | number }
interface Definition { title: string; endpoint: string; fields: Field[]; build: (values: Record<string, string>) => Record<string, unknown>; label: (row: Record<string, unknown>) => string; detail: (row: Record<string, unknown>) => string }

const number = (values: Record<string, string>, key: string, fallback = 0) => values[key] === '' || values[key] === undefined ? fallback : Number(values[key]);
const optionalNumber = (values: Record<string, string>, key: string) => values[key] ? Number(values[key]) : null;
const basicFields: Field[] = [{ name: 'name', label: 'Nombre', required: true }];

const definitions: Record<string, Definition> = {
  printers: {
    title: 'Impresoras', endpoint: '/api/printers', label: row => String(row.name), detail: row => `${String(row.manufacturer)} ${String(row.model)}`,
    fields: [...basicFields, { name: 'manufacturer', label: 'Fabricante', required: true }, { name: 'model', label: 'Modelo', required: true }, { name: 'voltage', label: 'Tensión (V)', type: 'number', defaultValue: 220 }, { name: 'manualHourlyRateGs', label: 'Costo manual por hora (Gs)', type: 'number' }],
    build: v => ({ name:v.name,manufacturer:v.manufacturer,model:v.model,voltage:number(v,'voltage',220),machineCostMode:'ManualHourlyRate',purchaseCostGs:null,residualValueGs:0,usefulLifeHours:null,expectedLifetimeRepairCostGs:0,maintenanceReserveGsPerHour:0,recoveryYears:null,businessDaysPerYear:null,plannedBillableHoursPerDay:null,repairReserveGsPerHour:0,manualHourlyRateGs:optionalNumber(v,'manualHourlyRateGs'),isActive:true })
  },
  filaments: {
    title: 'Filamentos e inventario', endpoint: '/api/filaments', label: row => `${String(row.material)} · ${String(row.color)}`, detail: row => `${String(row.productName)} · ${String(row.remainingWeightGrams)} g restantes`,
    fields: [{name:'manufacturer',label:'Fabricante',required:true},{name:'productName',label:'Producto',required:true},{name:'material',label:'Material',type:'select',options:['PLA','PETG','ABS','ASA','TPU','Otro'],required:true},{name:'color',label:'Color',required:true},{name:'batchCode',label:'Lote'},{name:'purchaseCurrency',label:'Moneda',type:'select',options:['PYG','USD','EUR'],defaultValue:'PYG'},{name:'purchaseAmount',label:'Precio de compra',type:'number',required:true},{name:'exchangeRateGs',label:'Tipo de cambio (si aplica)',type:'number'},{name:'netWeightGrams',label:'Peso neto original (g)',type:'number',defaultValue:1000},{name:'remainingWeightGrams',label:'Peso restante (g)',type:'number',defaultValue:1000},{name:'supplier',label:'Proveedor'}],
    build: v => ({manufacturer:v.manufacturer,productName:v.productName,material:v.material,color:v.color,batchCode:v.batchCode||null,purchaseCurrency:v.purchaseCurrency,purchaseAmount:number(v,'purchaseAmount'),exchangeRateGs:optionalNumber(v,'exchangeRateGs'),allocatedShippingGs:0,allocatedImportFeesGs:0,allocatedOtherCostsGs:0,netWeightGrams:number(v,'netWeightGrams'),remainingWeightGrams:number(v,'remainingWeightGrams'),purchasedAt:null,supplier:v.supplier||null,isInventoryTracked:true,isActive:true})
  },
  'electricity-tariffs': {
    title: 'Tarifas eléctricas', endpoint: '/api/electricity-tariffs', label: row => `${String(row.provider)} · ${String(row.name)}`, detail: row => `${String(row.baseRateGsPerKWh)} Gs/kWh`,
    fields: [{name:'provider',label:'Proveedor',defaultValue:'ANDE',required:true},...basicFields,{name:'category',label:'Categoría',required:true},{name:'baseRateGsPerKWh',label:'Tarifa base Gs/kWh',type:'number',required:true},{name:'additionalChargesPercent',label:'Cargos adicionales %',type:'number',defaultValue:0},{name:'explicitEffectiveRateGsPerKWh',label:'Tarifa efectiva explícita',type:'number'},{name:'sourceName',label:'Fuente'},{name:'verifiedAt',label:'Fecha de verificación',type:'date'}],
    build: v => ({provider:v.provider,name:v.name,category:v.category,baseRateGsPerKWh:number(v,'baseRateGsPerKWh'),excludesTax:true,additionalChargesPercent:number(v,'additionalChargesPercent'),explicitEffectiveRateGsPerKWh:optionalNumber(v,'explicitEffectiveRateGsPerKWh'),sourceName:v.sourceName||null,verifiedAt:v.verifiedAt||null,effectiveFrom:v.verifiedAt||null,effectiveTo:null,isActive:true})
  },
  customers: {
    title:'Clientes',endpoint:'/api/customers',label:row=>String(row.name),detail:row=>String(row.phone??row.email??''),fields:[...basicFields,{name:'phone',label:'Teléfono'},{name:'email',label:'Email'},{name:'notes',label:'Notas'}],build:v=>({name:v.name,phone:v.phone||null,email:v.email||null,notes:v.notes||null,isActive:true})
  },
  'product-templates': {
    title:'Plantillas de producto',endpoint:'/api/product-templates',label:row=>String(row.name),detail:row=>String(row.description??''),fields:[...basicFields,{name:'description',label:'Descripción'}],build:v=>({name:v.name,description:v.description||null,defaultPrinterId:null,defaultEnergyProfileId:null,defaultQuantityData:null,defaultLaborLines:null,defaultCostLines:null,isActive:true})
  },
  'pricing-policies': {
    title:'Política de precios',endpoint:'/api/pricing-policies',label:row=>String(row.name),detail:row=>`Margen ${String(row.targetMarginPercent)}% · mínimo ${String(row.minimumOrderGs)} Gs`,
    fields:[...basicFields,{name:'targetMarginPercent',label:'Margen objetivo %',type:'number',defaultValue:40},{name:'minimumMarginPercent',label:'Margen mínimo %',type:'number',defaultValue:30},{name:'failureProbability',label:'Probabilidad de falla (0 a 0,95)',type:'number',defaultValue:0.1},{name:'minimumOrderGs',label:'Pedido mínimo Gs',type:'number',defaultValue:30000},{name:'roundingIncrementGs',label:'Incremento de redondeo Gs',type:'number',defaultValue:5000},{name:'defaultLaborRateGsPerHour',label:'Tarifa laboral por hora',type:'number'}],
    build:v=>({name:v.name,targetMarginPercent:number(v,'targetMarginPercent'),minimumMarginPercent:number(v,'minimumMarginPercent'),minimumOrderGs:number(v,'minimumOrderGs'),roundingIncrementGs:number(v,'roundingIncrementGs'),roundUp:true,failureMode:'ExpectedAttempts',failureProbability:number(v,'failureProbability'),simpleFailureReservePercent:0,fixedOverheadPerOrderGs:0,overheadPercent:0,monthlyOverheadGs:0,expectedMonthlyProductiveHours:0,defaultLaborRateGsPerHour:optionalNumber(v,'defaultLaborRateGsPerHour'),variableSellingFeePercent:0,fixedSellingFeeGs:0,isDefault:false,effectiveFrom:null,effectiveTo:null,isActive:true})
  }
};

export function CatalogScreen({ resource }: { resource: string }) {
  const definition = definitions[resource];
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const load = () => get<Record<string, unknown>[]>(definition.endpoint).then(setRows).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error'));
  useEffect(() => { void load(); }, [definition.endpoint]);
  return <section className="page"><div className="page-heading"><div><h1>{definition.title}</h1><p>Los registros históricos se desactivan; no se eliminan si están referenciados.</p></div><button onClick={() => setShowForm(value => !value)}>{showForm ? 'Cerrar' : 'Agregar'}</button></div>
    {error ? <p className="error">{error}</p> : null}{showForm ? <form className="card form-grid" onSubmit={async event => {
      event.preventDefault(); const form = new FormData(event.currentTarget); const values = Object.fromEntries([...form.entries()].map(([k,v])=>[k,String(v)]));
      try { await post(definition.endpoint, definition.build(values)); event.currentTarget.reset(); setShowForm(false); load(); } catch(e) { setError(e instanceof Error?e.message:'Error'); }
    }}><h2>Nuevo registro</h2>{definition.fields.map(field => <label key={field.name}>{field.label}{field.type === 'select' ? <select name={field.name} defaultValue={field.defaultValue} required={field.required}>{field.options?.map(option=><option key={option}>{option}</option>)}</select> : <input name={field.name} type={field.type??'text'} step={field.type==='number'?'any':undefined} defaultValue={field.defaultValue} required={field.required}/>}</label>)}<div className="actions span-2"><button type="submit">Guardar</button></div></form> : null}
    <div className="card list">{rows.map(row=><div className="list-row static" key={String(row.id)}><span><strong>{definition.label(row)}</strong><small>{definition.detail(row)}</small></span><small className="status">{row.isActive===false?'Inactivo':'Activo'}</small></div>)}{rows.length===0?<p className="empty">No hay registros.</p>:null}</div>
  </section>;
}

export function EnergyProfilesScreen() {
  const [printers,setPrinters]=useState<Array<{id:string;name:string}>>([]); const [printerId,setPrinterId]=useState(''); const [rows,setRows]=useState<Record<string,unknown>[]>([]); const [error,setError]=useState<string|null>(null);
  useEffect(()=>{get<Array<{id:string;name:string}>>('/api/printers').then(items=>{setPrinters(items);setPrinterId(items[0]?.id??'');}).catch(()=>setError('No se pudieron cargar las impresoras.'));},[]);
  const load=()=>{if(printerId)get<Record<string,unknown>[]>(`/api/printers/${printerId}/energy-profiles`).then(setRows).catch(e=>setError(e instanceof Error?e.message:'Error'));}; useEffect(()=>{load();},[printerId]);
  return <section className="page"><div className="page-heading"><div><h1>Perfiles de energía</h1><p>La potencia máxima es solo una referencia; el promedio se usa para estimar.</p></div></div><label className="inline-control">Impresora<select value={printerId} onChange={e=>setPrinterId(e.target.value)}>{printers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    {error?<p className="error">{error}</p>:null}<form className="card form-grid" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await post(`/api/printers/${printerId}/energy-profiles`,{name:String(f.get('name')),materialFamily:String(f.get('material')),averagePrintPowerW:Number(f.get('average')),idlePowerW:Number(f.get('idle')),maxPowerW:Number(f.get('max')),warmupKWh:0,accessoryKWh:0,sourceName:String(f.get('source')||'')||null,verifiedAt:null,effectiveFrom:null,effectiveTo:null,isActive:true});e.currentTarget.reset();load();}catch(reason){setError(reason instanceof Error?reason.message:'Error');}}}>
      <h2>Nuevo perfil</h2><label>Nombre<input name="name" required/></label><label>Material<input name="material" required/></label><label>Potencia promedio W<input name="average" type="number" min="0" step="any" required/></label><label>Potencia idle W<input name="idle" type="number" min="0" step="any" required/></label><label>Potencia máxima W<input name="max" type="number" min="0" step="any" required/></label><label>Fuente<input name="source"/></label><div className="actions span-2"><button>Guardar perfil</button></div></form>
    <div className="card list">{rows.map(row=><div className="list-row static" key={String(row.id)}><span><strong>{String(row.name)}</strong><small>{String(row.materialFamily)} · promedio {String(row.averagePrintPowerW)} W · máxima {String(row.maxPowerW)} W</small></span></div>)}</div></section>;
}

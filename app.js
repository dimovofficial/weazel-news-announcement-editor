const APPS_SCRIPT="https://script.google.com/macros/s/AKfycbxSMZBGKtXhfDb3QCuQ-YAEIWc0wTmvl2JbjFOQeor_auIwoHRiYlxsfTQVqdVLmHl_/exec";
const state={categories:[],data:new Map(),query:"",loading:0};

const sections=document.getElementById("sections");
const search=document.getElementById("search");
const count=document.getElementById("count");
const status=document.getElementById("status");
const toast=document.getElementById("toast");
const categories=document.getElementById("categories");

const SERVICE=new Set(["Кодовые","Отклонения","Шаблоны"]);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const itemKey=x=>[x.sheetName,x.row,x.column].join(":");

function notify(t){
  toast.textContent=t;
  toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer=setTimeout(()=>toast.classList.remove("show"),1200);
}
async function copy(t){
  try{await navigator.clipboard.writeText(t)}
  catch{
    const a=document.createElement("textarea");
    a.value=t;document.body.appendChild(a);a.select();
    document.execCommand("copy");a.remove();
  }
  notify("Скопировано");
}

function jsonp(params){
  return new Promise((resolve,reject)=>{
    const callback="wnEditor_"+Date.now()+"_"+Math.random().toString(36).slice(2);
    const script=document.createElement("script");
    const url=new URL(APPS_SCRIPT);
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
    url.searchParams.set("prefix",callback);
    let done=false;
    const finish=(fn,value)=>{
      if(done)return;
      done=true;delete window[callback];script.remove();clearTimeout(timer);fn(value);
    };
    window[callback]=data=>finish(resolve,data);
    script.onerror=()=>finish(reject,new Error("JSONP error"));
    const timer=setTimeout(()=>finish(reject,new Error("JSONP timeout")),20000);
    script.src=url.toString();document.head.appendChild(script);
  });
}

async function request(params){
  const qs=new URLSearchParams(params).toString();
  let data=null;
  try{
    const r=await fetch("/api/editor?"+qs,{cache:"no-store",headers:{Accept:"application/json"}});
    const text=await r.text();
    try{data=JSON.parse(text)}catch{}
    if(data&&data.ok)return data;
    if(!r.ok)throw Error(data?.error||"API "+r.status);
  }catch(e){console.warn("Proxy API:",e)}
  const fallback=await jsonp(params);
  if(!fallback?.ok)throw Error(fallback?.error||"Apps Script API error");
  return fallback;
}

function renderCategories(){
  categories.innerHTML="";
  const groups=[
    {title:"ОСНОВНЫЕ",names:state.categories.filter(x=>!SERVICE.has(x))},
    {title:"СЛУЖЕБНЫЕ",names:state.categories.filter(x=>SERVICE.has(x))}
  ];
  groups.forEach(group=>{
    if(!group.names.length)return;
    const wrap=document.createElement("div");
    wrap.className="category-group";
    wrap.innerHTML='<div class="category-group-title">'+group.title+'</div>';
    const row=document.createElement("div");
    row.className="category-row";
    group.names.forEach(name=>{
      const b=document.createElement("button");
      b.type="button";b.className="category";b.textContent=name;
      b.onclick=()=>{
        const target=document.getElementById("section-"+CSS.escape(name));
        target?.scrollIntoView({behavior:"smooth",block:"start"});
      };
      row.appendChild(b);
    });
    wrap.appendChild(row);categories.appendChild(wrap);
  });
}

function normalizeItems(name,data){
  const items=Array.isArray(data?.items)?data.items:[];
  return items.map((x,i)=>({
    ...x,
    sheetName:x.sheetName||name,
    row:Number(x.row)||i+1,
    column:Number(x.column)||1,
    value:String(x.value??"").trim(),
    options:Array.isArray(x.options)&&x.options.length?x.options:[String(x.value??"").trim()],
    copyable:x.copyable!==false
  })).filter(x=>x.value||x.options.some(Boolean));
}

async function loadAll(){
  status.classList.remove("ok");
  status.innerHTML="<i></i> Синхронизация таблицы...";
  try{
    const cat=await request({action:"categories"});
    state.categories=Array.isArray(cat.categories)?cat.categories:[];
    if(!state.categories.length)throw Error("Категории не найдены");
    renderCategories();

    state.loading=state.categories.length;
    const results=await Promise.all(state.categories.map(async name=>{
      try{
        const data=await request({action:"category",category:name,limit:"10000"});
        return [name,{items:normalizeItems(name,data),total:Number(data.categoryTotal||data.total||data.items?.length||0),error:null}];
      }catch(error){
        return [name,{items:[],total:0,error}];
      }finally{
        state.loading--;
      }
    }));

    results.forEach(([name,value])=>state.data.set(name,value));
    const failed=results.filter(([,x])=>x.error);
    status.classList.add("ok");
    status.innerHTML=failed.length
      ? "<i></i> Таблица загружена с ошибками"
      : "<i></i> Таблица синхронизирована";
    renderAll();
  }catch(e){
    status.classList.remove("ok");
    status.innerHTML="<i></i> Ошибка подключения";
    sections.innerHTML='<div class="empty">Не удалось получить данные из Google Sheets.<br><small>'+esc(e?.message||"Неизвестная ошибка")+'</small></div>';
  }
}

function matches(item,q){
  if(!q)return true;
  const hay=[
    item.value,
    ...(item.options||[])
  ].join(" ").toLocaleLowerCase("ru-RU");
  return hay.includes(q.toLocaleLowerCase("ru-RU"));
}

function filteredItems(name){
  const block=state.data.get(name)||{items:[]};
  return block.items.filter(item=>matches(item,state.query));
}

function makeCopyButton(text,label){
  const b=document.createElement("button");
  b.type="button";b.className="value-copy";
  b.textContent=label||text;
  b.title="Нажмите, чтобы скопировать";
  b.onclick=()=>copy(text);
  return b;
}

function makeEditor(item){
  const box=document.createElement("div");
  box.className="entry-editor";
  const options=item.options?.length?item.options:[item.value];

  if(item.copyable===false){
    box.innerHTML='<span class="expired-text">'+esc(item.value)+'</span><small>срок действия истёк</small>';
    return box;
  }

  if(options.length>1){
    const select=document.createElement("select");
    select.className="template-select";
    options.forEach((option,index)=>{
      const o=document.createElement("option");
      o.value=option;o.textContent=option;
      if(index===0)o.selected=true;
      select.appendChild(o);
    });
    const copyBtn=document.createElement("button");
    copyBtn.type="button";copyBtn.className="copy-small";copyBtn.textContent="КОПИРОВАТЬ";
    copyBtn.onclick=()=>copy(select.value);
    select.onchange=()=>copy(select.value);
    box.append(select,copyBtn);
  }else{
    box.appendChild(makeCopyButton(item.value,item.value));
  }
  return box;
}

function renderCodewords(name,items,section){
  const rows=new Map();
  items.forEach(item=>{
    if(!rows.has(item.row))rows.set(item.row,{});
    rows.get(item.row)[item.column]=item;
  });
  const table=document.createElement("div");
  table.className="code-table";
  const head=document.createElement("div");
  head.className="code-head";
  ["КОДОВОЕ","ШАБЛОН","СРОК","СВЯЗЬ"].forEach(x=>{
    const d=document.createElement("div");d.textContent=x;head.appendChild(d);
  });
  table.appendChild(head);
  [...rows.entries()].sort((a,b)=>a[0]-b[0]).forEach(([,row])=>{
    const line=document.createElement("div");line.className="code-row";
    for(let c=1;c<=4;c++){
      const cell=document.createElement("div");cell.className="code-cell";
      const item=row[c];
      if(item){
        if(c===1)cell.appendChild(makeCopyButton(item.value,item.value));
        else if(c===2)cell.appendChild(makeEditor(item));
        else cell.textContent=item.value;
      }
      line.appendChild(cell);
    }
    table.appendChild(line);
  });
  section.appendChild(table);
}

function renderGeneric(name,items,section){
  const grid=document.createElement("div");
  grid.className="entry-grid";
  items.sort((a,b)=>a.row-b.row||a.column-b.column).forEach(item=>{
    const card=document.createElement("article");
    card.className="entry-card";
    const title=document.createElement("div");
    title.className="entry-title";
    title.textContent=item.value;
    card.appendChild(title);
    if(item.options?.length>1)card.appendChild(makeEditor(item));
    else if(item.copyable!==false)card.appendChild(makeCopyButton(item.value,"СКОПИРОВАТЬ"));
    else card.appendChild(makeEditor(item));
    grid.appendChild(card);
  });
  section.appendChild(grid);
}

function renderDeviation(name,items,section){
  const grid=document.createElement("div");grid.className="deviation-grid";
  items.sort((a,b)=>a.row-b.row||a.column-b.column).forEach(item=>{
    const card=document.createElement("article");card.className="deviation-card";
    const title=document.createElement("div");title.className="deviation-title";title.textContent=item.value;
    card.appendChild(title);
    if(item.options?.length>1)card.appendChild(makeEditor(item));
    else card.appendChild(makeCopyButton(item.value,"КОПИРОВАТЬ"));
    grid.appendChild(card);
  });
  section.appendChild(grid);
}

function renderSection(name){
  const block=state.data.get(name)||{items:[],total:0};
  const items=filteredItems(name);
  const section=document.createElement("section");
  section.className="section polished-section";
  section.id="section-"+name;
  section.innerHTML='<div class="sectionhead"><div><h2>'+esc(name)+'</h2><p>'+esc(sectionDescription(name))+'</p></div><span>'+items.length+(state.query?" найдено":" позиций")+'</span></div>';

  if(block.error){
    section.insertAdjacentHTML("beforeend",'<div class="section-error">Раздел не удалось загрузить: '+esc(block.error.message)+'</div>');
    return section;
  }
  if(!items.length){
    section.insertAdjacentHTML("beforeend",'<div class="section-empty">'+(state.query?"По запросу ничего не найдено.":"В разделе нет заполненных данных.")+'</div>');
    return section;
  }

  if(name==="Кодовые")renderCodewords(name,items,section);
  else if(name==="Отклонения")renderDeviation(name,items,section);
  else renderGeneric(name,items,section);
  return section;
}

function sectionDescription(name){
  const descriptions={
    "Кодовые":"Кодовые слова, готовые сообщения, сроки действия и контакты.",
    "Отклонения":"Готовые причины и формулировки для отклонения объявлений.",
    "Шаблоны":"Общие шаблоны и заготовки для объявлений.",
    "Одежда":"Выберите предмет и нужный вариант объявления.",
    "Сумки и рюкзаки":"Предметы и варианты объявлений для категории.",
    "Транспорт":"Автомобили и готовые варианты продажи, покупки и аренды.",
    "24/7 и др.":"Товары и другие позиции с готовыми вариантами.",
    "Рыбалка":"Предметы рыбалки и варианты объявлений.",
    "Маски":"Маски и готовые варианты объявлений.",
    "Secret Shop":"Позиции Secret Shop и варианты объявлений."
  };
  return descriptions[name]||"Данные из рабочей таблицы Weazel News.";
}

function renderAll(){
  const fragment=document.createDocumentFragment();
  let totalVisible=0,totalAll=0;
  state.categories.forEach(name=>{
    const block=state.data.get(name)||{items:[],total:0};
    totalAll+=block.total||block.items.length;
    totalVisible+=filteredItems(name).length;
    fragment.appendChild(renderSection(name));
  });
  sections.innerHTML="";
  sections.appendChild(fragment);
  count.textContent=state.query
    ? totalVisible+" найдено по всем разделам"
    : totalAll+" позиций во всех разделах";
}

let searchTimer;
search.addEventListener("input",()=>{
  state.query=search.value.trim();
  clearTimeout(searchTimer);
  searchTimer=setTimeout(renderAll,60);
});

document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="f"){
    e.preventDefault();
    search.focus();
    search.select();
  }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){
    e.preventDefault();
    search.focus();
    search.select();
  }
});

search.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    search.value="";
    state.query="";
    renderAll();
    search.blur();
  }
});

loadAll();

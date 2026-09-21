const state={items:[],query:"",category:"",total:0,categories:[]};
const sections=document.getElementById("sections"),search=document.getElementById("search"),count=document.getElementById("count"),status=document.getElementById("status"),toast=document.getElementById("toast"),categories=document.getElementById("categories");

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key=x=>[x.sheetName,x.row,x.column].join(":");

function notify(t){toast.textContent=t;toast.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove("show"),1200)}
async function copy(t){try{await navigator.clipboard.writeText(t)}catch{const a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove()}notify("Скопировано")}

function renderCategories(){
  categories.innerHTML="";
  const groups=[
    {title:"ОСНОВНЫЕ",names:state.categories.filter(x=>!["Кодовые","Отклонения","Шаблоны"].includes(x))},
    {title:"СЛУЖЕБНЫЕ",names:state.categories.filter(x=>["Кодовые","Отклонения","Шаблоны"].includes(x))}
  ];
  groups.forEach(group=>{
    if(!group.names.length)return;
    const wrap=document.createElement("div");wrap.className="category-group";
    const title=document.createElement("div");title.className="category-group-title";title.textContent=group.title;wrap.appendChild(title);
    const row=document.createElement("div");row.className="category-row";
    group.names.forEach(name=>{
      const b=document.createElement("button");
      b.type="button";b.className="category"+(name===state.category?" active":"");b.textContent=name;
      b.onclick=()=>{if(name===state.category)return;state.category=name;state.query="";search.value="";renderCategories();load()};
      row.appendChild(b);
    });
    wrap.appendChild(row);categories.appendChild(wrap);
  });
}

function jsonp(params){
  return new Promise((resolve,reject)=>{
    const callback="wnEditor_"+Date.now()+"_"+Math.random().toString(36).slice(2);
    const script=document.createElement("script"),url=new URL("https://script.google.com/macros/s/AKfycbxSMZBGKtXhfDb3QCuQ-YAEIWc0wTmvl2JbjFOQeor_auIwoHRiYlxsfTQVqdVLmHl_/exec");
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
    url.searchParams.set("prefix",callback);
    let done=false;
    const finish=(fn,value)=>{if(done)return;done=true;delete window[callback];script.remove();clearTimeout(timer);fn(value)};
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
  if(!fallback||!fallback.ok)throw Error(fallback&&fallback.error||"Apps Script API error");
  return fallback;
}

async function loadCategories(){
  const data=await request({action:"categories"});
  state.categories=Array.isArray(data.categories)?data.categories:[];
  if(!state.categories.length)throw Error("Категории не найдены");
  if(!state.category||!state.categories.includes(state.category))state.category=state.categories[0];
  renderCategories();
}

async function load(){
  status.classList.remove("ok");
  status.innerHTML="<i></i> Загрузка "+esc(state.category);
  try{
    const q=search.value.trim();
    const data=await request({action:"category",category:state.category,...(q?{q}:{})});
    state.items=Array.isArray(data.items)?data.items:[];
    state.total=Number(data.categoryTotal||data.total||state.items.length);
    status.classList.add("ok");
    status.innerHTML="<i></i> Данные синхронизированы";
    renderTable();
  }catch(e){
    status.classList.remove("ok");
    status.innerHTML="<i></i> Ошибка подключения";
    sections.innerHTML='<div class="empty">Не удалось загрузить данные.<br><small style="display:block;margin-top:10px;color:#777">'+esc(e&&e.message?e.message:"Неизвестная ошибка")+'</small></div>';
    console.error("Editor API:",e);
  }
}

function columnName(n){
  let s="";
  while(n){let r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}
  return s;
}

function renderTable(){
  count.textContent=state.query?state.items.length+" результатов"+(state.total>state.items.length?" из "+state.total:""):state.total+" позиций";
  sections.innerHTML="";
  if(!state.items.length){
    sections.innerHTML='<div class="empty">'+(state.query?"Ничего не найдено в категории «"+esc(state.category)+"».":"В категории пока нет заполненных данных.")+'</div>';
    return;
  }

  const byCell=new Map(state.items.map(item=>[key(item),item]));
  const maxRow=Math.max(...state.items.map(x=>Number(x.row)||1),1);
  const maxCol=Math.max(...state.items.map(x=>Number(x.column)||1),1);

  const sec=document.createElement("section");sec.className="section sheet-section";
  sec.innerHTML='<div class="sectionhead"><h2>'+esc(state.category)+'</h2><span>'+state.items.length+" ПОЗИЦИЙ</span></div>";

  const wrap=document.createElement("div");wrap.className="sheet-wrap";
  const table=document.createElement("table");table.className="sheet-table";
  const thead=document.createElement("thead");
  const hr=document.createElement("tr");
  hr.innerHTML='<th class="corner"></th>';
  for(let c=1;c<=maxCol;c++){const th=document.createElement("th");th.textContent=columnName(c);hr.appendChild(th)}
  thead.appendChild(hr);table.appendChild(thead);

  const tbody=document.createElement("tbody");
  for(let r=1;r<=maxRow;r++){
    const tr=document.createElement("tr");
    const rh=document.createElement("th");rh.className="row-number";rh.textContent=r;tr.appendChild(rh);
    for(let c=1;c<=maxCol;c++){
      const td=document.createElement("td");
      const item=byCell.get(state.category+":"+r+":"+c);
      if(item){
        td.className="sheet-cell populated"+(item.copyable===false?" expired":"");
        const options=Array.isArray(item.options)&&item.options.length?item.options:[item.value];
        if(item.copyable===false){
          td.innerHTML='<span class="cell-value expired-value">'+esc(item.value)+'</span><small>истёк</small>';
        }else if(options.length>1){
          const select=document.createElement("select");
          select.className="cell-select";
          options.forEach(option=>{
            const opt=document.createElement("option");
            opt.value=option;opt.textContent=option;
            if(option===item.value)opt.selected=true;
            select.appendChild(opt);
          });
          select.title="Выберите вариант";
          select.onchange=async()=>{await copy(select.value);select.value=item.value};
          td.appendChild(select);
        }else{
          const button=document.createElement("button");
          button.type="button";button.className="cell-copy";button.textContent=item.value;
          button.title="Нажмите, чтобы скопировать";
          button.onclick=()=>copy(item.value);
          td.appendChild(button);
        }
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);wrap.appendChild(table);sec.appendChild(wrap);sections.appendChild(sec);
}

let searchTimer;
search.addEventListener("input",()=>{
  state.query=search.value;clearTimeout(searchTimer);searchTimer=setTimeout(load,180);
});

document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="f"){
    e.preventDefault();search.focus();search.select();
  }
});

search.addEventListener("keydown",e=>{
  if(e.key==="Escape"){search.value="";state.query="";load();search.blur()}
});

(async()=>{
  try{await loadCategories();await load()}
  catch(e){
    status.classList.remove("ok");status.innerHTML="<i></i> Ошибка подключения";
    sections.innerHTML='<div class="empty">Не удалось получить список разделов из Google Sheets.<br><small style="display:block;margin-top:10px;color:#777">'+esc(e&&e.message?e.message:"Неизвестная ошибка")+'</small></div>';
    console.error("Editor bootstrap:",e);
  }
})();
const CATEGORIES=["Одежда","Рыбалка","Маски","Сумки и рюкзаки","Secret Shop","Транспорт","24/7 и др."];
const APPS_SCRIPT="https://script.google.com/macros/s/AKfycbxQWBnu8p3C-fc0sSJOT-iJhtJhJdJuO_NBBCFjjGhyNPeHUUgsEASpMMdHzOlmdwvI/exec";
const state={items:[],query:"",category:CATEGORIES[0],open:null,total:0};
const sections=document.getElementById("sections"),search=document.getElementById("search"),count=document.getElementById("count"),status=document.getElementById("status"),toast=document.getElementById("toast"),categories=document.getElementById("categories");

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key=x=>[x.sheetName,x.row,x.column].join(":");

function notify(t){toast.textContent=t;toast.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove("show"),1200)}
async function copy(t){try{await navigator.clipboard.writeText(t)}catch{const a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove()}notify("Скопировано")}

function renderCategories(){
  categories.innerHTML="";
  CATEGORIES.forEach(name=>{
    const b=document.createElement("button");
    b.type="button";
    b.className="category"+(name===state.category?" active":"");
    b.textContent=name;
    b.onclick=()=>{if(name===state.category)return;state.category=name;state.query="";state.open=null;search.value="";renderCategories();load()};
    categories.appendChild(b);
  });
}

function jsonp(params){
  return new Promise((resolve,reject)=>{
    const callback="wnEditor_"+Date.now()+"_"+Math.random().toString(36).slice(2);
    const script=document.createElement("script");
    const url=new URL(APPS_SCRIPT);
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
    url.searchParams.set("prefix",callback);
    let done=false;
    const finish=(fn,value)=>{if(done)return;done=true;delete window[callback];script.remove();clearTimeout(timer);fn(value)};
    window[callback]=data=>finish(resolve,data);
    script.onerror=()=>finish(reject,new Error("JSONP error"));
    document.head.appendChild(script);
    const timer=setTimeout(()=>finish(reject,new Error("JSONP timeout")),20000);
    script.src=url.toString();
  });
}

async function loadViaJsonp(){
  const q=search.value.trim();
  const data=await jsonp({action:"category",category:state.category,q});
  if(!data||!data.ok)throw Error(data&&data.error||"Apps Script API error");
  return data;
}

async function load(){
  status.classList.remove("ok");
  status.innerHTML="<i></i> Загрузка "+esc(state.category);
  try{
    const q=search.value.trim();
    const url="/api/editor?action=category&category="+encodeURIComponent(state.category)+(q?"&q="+encodeURIComponent(q):"");
    let r;
    try{r=await fetch(url,{cache:"no-store",headers:{Accept:"application/json"}})}catch{r=null}
    let data=null;
    if(r&&r.ok){
      const text=await r.text();
      try{data=JSON.parse(text)}catch{}
    }
    if(!data||!data.ok)data=await loadViaJsonp();

    state.items=Array.isArray(data.items)?data.items:[];
    state.total=Number(data.categoryTotal||data.total||state.items.length);
    status.classList.add("ok");
    status.innerHTML="<i></i> Данные синхронизированы";
    render();
  }catch(e){
    status.classList.remove("ok");
    status.innerHTML="<i></i> Ошибка подключения";
    sections.innerHTML='<div class="empty">Не удалось загрузить данные.<br><small style="display:block;margin-top:10px;color:#555">Источник таблицы не ответил. После изменения данных в Google Sheets обновите страницу.</small></div>';
    console.error("Editor API:",e);
  }
}

function render(){
  const q=state.query.trim();
  count.textContent=q?state.items.length+" результатов"+(state.total>state.items.length?" из "+state.total:""):state.total+" позиций";
  sections.innerHTML="";
  if(!state.items.length){
    sections.innerHTML='<div class="empty">'+(q?"Ничего не найдено в категории «"+esc(state.category)+"».":"В категории пока нет заполненных позиций.")+'</div>';
    return;
  }

  const sec=document.createElement("section");sec.className="section";
  sec.innerHTML='<div class="sectionhead"><h2>'+esc(state.category)+'</h2><span>'+state.items.length+" ПОЗИЦИЙ</span></div>";
  const box=document.createElement("div");box.className="items";

  for(const item of state.items){
    const b=document.createElement("button");
    const has=(item.options||[]).length>1;
    b.className="item"+(has?" hasoptions":"");
    b.innerHTML="<span>"+esc(item.value)+"</span>"+(has?"<small>выбрать шаблон</small>":"");
    b.onclick=async()=>{
      if(!has){await copy(item.value);return}
      state.open=state.open===key(item)?null:key(item);
      render();
    };
    box.appendChild(b);

    if(state.open===key(item)){
      const choices=document.createElement("div");choices.className="choices";
      for(const option of item.options||[]){
        const c=document.createElement("button");c.className="choice";c.textContent=option;
        c.onclick=async e=>{e.stopPropagation();await copy(option);state.open=null;render()};
        choices.appendChild(c);
      }
      box.appendChild(choices);
    }
  }

  sec.appendChild(box);sections.appendChild(sec);
}

let searchTimer;
search.addEventListener("input",()=>{
  state.query=search.value;
  state.open=null;
  clearTimeout(searchTimer);
  searchTimer=setTimeout(load,250);
});

renderCategories();
load();

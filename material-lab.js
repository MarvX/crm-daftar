
/* DAST MATERIAL LAB — modular front-end */
(function(){
    if (typeof SECTION_TITLES !== 'undefined') SECTION_TITLES['material-lab']='Material Lab';

  var ML = {
    view:'materials', query:'', category:'', supplier:'', application:'', boardId:'',
    materials:[], suppliers:[], catalogs:[], categories:[], boards:[], items:[], favorites:[], requests:[], prices:[]
  };

  function money(v){ return Number(v||0)>0 ? Number(v).toLocaleString('fa-IR') : 'ثبت نشده'; }
  function catName(id){ var x=ML.categories.find(function(c){return c.id===id;}); return x?x.name_fa:'بدون دسته'; }
  function sup(id){ return ML.suppliers.find(function(s){return s.id===id;}); }
  function supName(id){ var x=sup(id); return x?x.name:'شرکت ثبت نشده'; }
  function safeUrl(v){
    try { var u=new URL(String(v||''),location.origin); return ['http:','https:'].indexOf(u.protocol)>=0?u.href:''; } catch(e){ return ''; }
  }
  function phone(v){ return String(v||'').replace(/[^\d+]/g,'').replace(/^00/,'+'); }
  function wa(v){ var d=phone(v).replace(/\D/g,''); return d?'https://wa.me/'+d:''; }
  function priceLabel(m){ return Number(m.price||0)>0 ? money(m.price)+' '+(m.price_unit||'مترمربع') : 'قیمت ثبت نشده'; }
  function admin(){ return !!currentProfile && !!currentProfile.is_admin; }

  async function load(){
    var r = await Promise.all([
      sb.from('materials').select('*').order('created_at',{ascending:false}),
      sb.from('material_suppliers').select('*').order('name'),
      sb.from('material_catalogs').select('*').order('created_at',{ascending:false}),
      sb.from('material_categories').select('*').order('sort_order').order('name_fa'),
      sb.from('material_boards').select('*').order('updated_at',{ascending:false}),
      sb.from('material_board_items').select('*').order('position').order('created_at'),
      sb.from('material_favorites').select('material_id').eq('user_id',currentUser ? currentUser.id : ''),
      sb.from('material_quote_requests').select('*').order('created_at',{ascending:false}),
      sb.from('material_price_history').select('*').order('recorded_at',{ascending:false}).limit(200)
    ]);
    ML.materials=r[0].data||[]; ML.suppliers=r[1].data||[]; ML.catalogs=r[2].data||[]; ML.categories=r[3].data||[];
    ML.boards=r[4].data||[]; ML.items=r[5].data||[]; ML.favorites=(r[6].data||[]).map(function(x){return x.material_id;});
    ML.requests=r[7].data||[]; ML.prices=r[8].data||[];
    r.forEach(function(x,i){if(x.error) console.warn('Material Lab query',i,x.error.message);});
  }

  function stats(){
    var priced=ML.materials.filter(function(m){return Number(m.price||0)>0;}).length;
    return '<div class="grid-stats material-stats">'+
      '<div class="stat"><div class="num">'+ML.materials.length.toLocaleString('fa-IR')+'</div><div class="label">متریال ثبت‌شده</div></div>'+
      '<div class="stat"><div class="num">'+ML.suppliers.length.toLocaleString('fa-IR')+'</div><div class="label">شرکت / تأمین‌کننده</div></div>'+
      '<div class="stat"><div class="num">'+ML.catalogs.length.toLocaleString('fa-IR')+'</div><div class="label">کاتالوگ و کتاب</div></div>'+
      '<div class="stat"><div class="num">'+priced.toLocaleString('fa-IR')+'</div><div class="label">متریال دارای قیمت</div></div>'+
      '<div class="stat"><div class="num">'+ML.boards.length.toLocaleString('fa-IR')+'</div><div class="label">برد پروژه</div></div>'+
    '</div>';
  }

  function tabs(){
    var a=[['materials','🧱 متریال‌ها'],['suppliers','🏢 شرکت‌ها'],['catalogs','📚 کاتالوگ‌ها'],['boards','🎨 برد پروژه'],['categories','🗂️ دسته‌بندی'],['prices','💰 قیمت‌ها'],['requests','📞 درخواست قیمت']];
    return '<div class="material-tabs">'+a.map(function(x){return '<button class="material-tab '+(ML.view===x[0]?'active':'')+'" onclick="MaterialLab.setView(\\''+x[0]+'\\')">'+x[1]+'</button>';}).join('')+'</div>';
  }

  function render(){
    var h='<div class="row-top material-hero"><div><div class="eyebrow">DAST MATERIAL LAB</div><h2 style="font-size:23px;margin:0 0 6px;">آزمایشگاه متریال</h2><div style="font-size:12px;color:var(--muted);max-width:780px;line-height:2;">بانک متریال دفتر؛ از کاتالوگ و شرکت سازنده تا قیمت، انتخاب برای پروژه، درخواست قیمت و برآورد اولیه.</div></div>'+
      '<div class="material-hero-actions">'+
      (admin()?'<button class="btn small" onclick="MaterialLab.openMaterial()">+ متریال</button><button class="btn small secondary" onclick="MaterialLab.openSupplier()">+ شرکت</button><button class="btn small secondary" onclick="MaterialLab.openCatalog()">+ کاتالوگ</button>':'')+
      '<button class="btn small secondary" onclick="MaterialLab.openBoard()">+ برد پروژه</button></div></div>'+stats()+tabs();
    if(ML.view==='materials') h+=materials();
    else if(ML.view==='suppliers') h+=suppliers();
    else if(ML.view==='catalogs') h+=catalogs();
    else if(ML.view==='boards') h+=boards();
    else if(ML.view==='categories') h+=categories();
    else if(ML.view==='prices') h+=prices();
    else h+=requests();
    return h;
  }

  function refreshDom(){
    var s=document.getElementById('section-material-lab');
    if(s && !s.classList.contains('hidden')) s.innerHTML=render();
  }
  var timer=null;
  function materials(){
    var q=ML.query.trim().toLowerCase();
    var list=ML.materials.filter(function(m){
      var hay=[m.name_fa,m.name_en,m.brand,m.manufacturer,m.color,m.finish,m.code,m.subcategory].join(' ').toLowerCase();
      return (!q||hay.indexOf(q)>=0)&&(!ML.category||m.category_id===ML.category)&&(!ML.supplier||m.supplier_id===ML.supplier)&&(!ML.application||m.application_type===ML.application);
    });
    return '<div class="card material-filter-card"><div class="row material-filters">'+
      '<input value="'+escapeHtml(ML.query)+'" oninput="MaterialLab.search(this.value)" placeholder="جست‌وجوی نام، برند، شرکت، رنگ، کد...">'+
      '<select onchange="MaterialLab.filter(\\'category\\',this.value)"><option value="">همه دسته‌ها</option>'+ML.categories.map(function(c){return '<option value="'+c.id+'" '+(ML.category===c.id?'selected':'')+'>'+escapeHtml(c.name_fa)+'</option>';}).join('')+'</select>'+
      '<select onchange="MaterialLab.filter(\\'supplier\\',this.value)"><option value="">همه شرکت‌ها</option>'+ML.suppliers.map(function(s){return '<option value="'+s.id+'" '+(ML.supplier===s.id?'selected':'')+'>'+escapeHtml(s.name)+'</option>';}).join('')+'</select>'+
      '<select onchange="MaterialLab.filter(\\'application\\',this.value)"><option value="">همه کاربردها</option>'+['نما','داخلی','هر دو'].map(function(a){return '<option '+(ML.application===a?'selected':'')+'>'+a+'</option>';}).join('')+'</select>'+
      '</div><div style="font-size:11px;color:var(--muted);margin-top:7px;">'+list.length.toLocaleString('fa-IR')+' نتیجه · داده‌ها را می‌توانیم هر روز از روی کاتالوگ‌ها کامل کنیم.</div></div>'+
      '<div class="material-grid">'+(list.length?list.map(card).join(''):'<div class="card"><div class="empty">هنوز متریالی با این فیلتر پیدا نشد.</div></div>')+'</div>';
  }
  function card(m){
    var s=sup(m.supplier_id), fav=ML.favorites.indexOf(m.id)>=0, img=safeUrl(m.image_url);
    return '<article class="material-card"><div class="material-card-cover '+(img?'has-image':'')+'">'+(img?'<img src="'+escapeHtml(img)+'" alt="'+escapeHtml(m.name_fa)+'" loading="lazy">':'<span>🧱</span>')+
      '<button class="material-fav '+(fav?'active':'')+'" onclick="MaterialLab.favorite(\\''+m.id+'\\')" title="علاقه‌مندی">'+(fav?'★':'☆')+'</button></div>'+
      '<div class="material-card-body"><div class="material-card-top"><span class="tag">'+escapeHtml(catName(m.category_id))+'</span><span class="material-stock">'+escapeHtml(m.stock_status||'نامشخص')+'</span></div>'+
      '<h3>'+escapeHtml(m.name_fa)+'</h3>'+(m.name_en?'<div class="material-en">'+escapeHtml(m.name_en)+'</div>':'')+
      '<div class="material-meta">'+escapeHtml([m.brand||m.manufacturer,m.finish,m.application_type||'هر دو'].filter(Boolean).join(' · '))+'</div>'+
      '<div class="material-price">'+priceLabel(m)+'</div><div class="material-supplier">🏢 '+escapeHtml(s?s.name:'شرکت ثبت نشده')+'</div>'+
      '<div class="material-card-actions"><button class="btn small" onclick="MaterialLab.details(\\''+m.id+'\\')">جزئیات</button>'+
      ((s&&(s.phone||s.mobile))?'<a class="btn small secondary" href="tel:'+escapeHtml(phone(s.phone||s.mobile))+'">📞 تماس</a>':'')+
      (admin()?'<button class="btn small secondary" onclick="MaterialLab.openMaterial(\\''+m.id+'\\')">ویرایش</button>':'')+
      '</div></div></article>';
  }

  function suppliers(){
    return '<div class="row-top"><div><h2>شرکت‌ها و تأمین‌کننده‌ها</h2><div class="material-section-desc">اطلاعات تماس، سایت، شخص تماس و تمام متریال‌های هر شرکت.</div></div>'+(admin()?'<button class="btn" onclick="MaterialLab.openSupplier()">+ شرکت جدید</button>':'')+'</div>'+
      '<div class="supplier-grid">'+(ML.suppliers.length?ML.suppliers.map(function(s){
        return '<article class="card supplier-card"><div class="supplier-head"><div><span class="eyebrow">SUPPLIER</span><h3>'+escapeHtml(s.name)+'</h3>'+(s.brand_name?'<div class="material-en">'+escapeHtml(s.brand_name)+'</div>':'')+'</div><span class="supplier-avatar">🏢</span></div>'+
        (s.contact_person?'<div class="material-line">👤 '+escapeHtml(s.contact_person)+'</div>':'')+(s.city?'<div class="material-line">📍 '+escapeHtml(s.city)+'</div>':'')+(s.phone||s.mobile?'<div class="material-line">📞 '+escapeHtml(s.phone||s.mobile)+'</div>':'')+
        '<div class="supplier-actions">'+((s.phone||s.mobile)?'<a class="btn small" href="tel:'+escapeHtml(phone(s.phone||s.mobile))+'">تماس</a>':'')+(s.whatsapp?'<a class="btn small secondary" target="_blank" rel="noopener" href="'+escapeHtml(wa(s.whatsapp))+'">واتساپ</a>':'')+(safeUrl(s.website)?'<a class="btn small secondary" target="_blank" rel="noopener" href="'+escapeHtml(safeUrl(s.website))+'">سایت</a>':'')+
        '<button class="btn small secondary" onclick="MaterialLab.filterSupplier(\\''+s.id+'\\')">متریال‌ها</button>'+(admin()?'<button class="btn small danger" onclick="MaterialLab.deleteSupplier(\\''+s.id+'\\')">حذف</button>':'')+'</div></article>';
      }).join(''):'<div class="card"><div class="empty">هنوز شرکتی ثبت نشده.</div></div>')+'</div>';
  }

  function catalogs(){
    return '<div class="row-top"><div><h2>کتابخانه کاتالوگ‌ها</h2><div class="material-section-desc">نسخه فیزیکی، فایل دیجیتال، شرکت، سال و دسته را کنار هم ثبت می‌کنیم.</div></div>'+(admin()?'<button class="btn" onclick="MaterialLab.openCatalog()">+ کاتالوگ / کتاب</button>':'')+'</div>'+
      '<div class="catalog-grid">'+(ML.catalogs.length?ML.catalogs.map(function(c){
        return '<article class="card catalog-card"><div class="catalog-cover">'+(safeUrl(c.cover_url)?'<img src="'+escapeHtml(safeUrl(c.cover_url))+'" alt="">':'📚')+'</div><div class="catalog-copy"><span class="eyebrow">'+escapeHtml(c.catalog_kind||'کاتالوگ')+'</span><h3>'+escapeHtml(c.title)+'</h3>'+
        '<div class="material-line">🏢 '+escapeHtml(supName(c.supplier_id))+'</div>'+(c.publisher?'<div class="material-line">ناشر / سازنده: '+escapeHtml(c.publisher)+'</div>':'')+(c.year?'<div class="material-line">سال: '+Number(c.year).toLocaleString('fa-IR')+'</div>':'')+(c.category?'<div class="material-line">دسته: '+escapeHtml(c.category)+'</div>':'')+(c.physical_location?'<div class="material-line">📦 '+escapeHtml(c.physical_location)+'</div>':'')+
        '<div class="catalog-actions">'+(safeUrl(c.file_url)?'<a class="btn small" target="_blank" rel="noopener" href="'+escapeHtml(safeUrl(c.file_url))+'">باز کردن فایل</a>':'')+(admin()?'<button class="btn small danger" onclick="MaterialLab.deleteCatalog(\\''+c.id+'\\')">حذف</button>':'')+'</div></div></article>';
      }).join(''):'<div class="card"><div class="empty">هنوز کاتالوگی ثبت نشده.</div></div>')+'</div>';
  }

  function categories(){
    return '<div class="row-top"><div><h2>دسته‌بندی‌ها</h2><div class="material-section-desc">این دسته‌بندی هسته جست‌وجوی آینده Material Lab است.</div></div>'+(admin()?'<button class="btn" onclick="MaterialLab.openCategory()">+ دسته جدید</button>':'')+'</div>'+
      '<div class="category-grid">'+(ML.categories.length?ML.categories.map(function(c){
        var count=ML.materials.filter(function(m){return m.category_id===c.id;}).length;
        return '<div class="card category-card"><div class="category-icon">'+escapeHtml(c.icon||'🧱')+'</div><div><strong>'+escapeHtml(c.name_fa)+'</strong>'+(c.name_en?'<div class="material-en">'+escapeHtml(c.name_en)+'</div>':'')+'<div style="font-size:11px;color:var(--muted);margin-top:5px;">'+count.toLocaleString('fa-IR')+' متریال</div></div>'+ (admin()?'<button class="btn small danger" onclick="MaterialLab.deleteCategory(\\''+c.id+'\\')">حذف</button>':'')+'</div>';
      }).join(''):'<div class="card"><div class="empty">هنوز دسته‌ای تعریف نشده.</div></div>')+'</div>';
  }

  function prices(){
    var rows=ML.prices.slice(0,80);
    return '<div class="row-top"><div><h2>تاریخچه قیمت</h2><div class="material-section-desc">هر تغییر قیمت سابقه‌اش را نگه می‌دارد تا برای مقایسه و برآورد بعدی قابل استفاده باشد.</div></div></div>'+
      '<div class="card table-wrap">'+(rows.length?'<table><thead><tr><th>متریال</th><th>قیمت</th><th>واحد</th><th>شرکت</th><th>تاریخ</th><th>منبع</th></tr></thead><tbody>'+rows.map(function(r){
        var m=ML.materials.find(function(x){return x.id===r.material_id;});
        return '<tr><td><strong>'+escapeHtml(m?m.name_fa:'—')+'</strong></td><td>'+money(r.price)+' تومان</td><td>'+escapeHtml(r.price_unit||(m&&m.price_unit)||'—')+'</td><td>'+escapeHtml(supName(r.supplier_id||(m&&m.supplier_id)))+'</td><td>'+escapeHtml(r.recorded_at||'—')+'</td><td>'+escapeHtml(r.source||r.note||'—')+'</td></tr>';
      }).join('')+'</tbody></table>':'<div class="empty">هنوز سابقه قیمتی ثبت نشده.</div>')+'</div>';
  }

  function requests(){
    var rows=ML.requests.filter(function(r){return admin()||r.requested_by===currentUser.id;});
    return '<div class="row-top"><div><h2>درخواست قیمت</h2><div class="material-section-desc">درخواست‌هایی که از شرکت‌ها می‌گیریم اینجا متمرکز می‌شوند.</div></div></div>'+
      '<div class="card table-wrap">'+(rows.length?'<table><thead><tr><th>متریال</th><th>پروژه</th><th>شرکت</th><th>مقدار</th><th>وضعیت</th><th>تاریخ</th></tr></thead><tbody>'+rows.map(function(r){
        var m=ML.materials.find(function(x){return x.id===r.material_id;}), p=projects.find(function(x){return x.id===r.project_id;});
        return '<tr><td>'+escapeHtml(m?m.name_fa:'—')+'</td><td>'+escapeHtml(p?p.title:'—')+'</td><td>'+escapeHtml(supName(r.supplier_id||(m&&m.supplier_id)))+'</td><td>'+ (r.quantity?Number(r.quantity).toLocaleString('fa-IR')+' '+escapeHtml(r.unit||''):'—')+'</td><td><span class="tag">'+escapeHtml(r.status||'جدید')+'</span></td><td>'+escapeHtml(String(r.created_at||'').slice(0,10))+'</td></tr>';
      }).join('')+'</tbody></table>':'<div class="empty">هنوز درخواست قیمتی ثبت نشده.</div>')+'</div>';
  }

  function boards(){
    if(!ML.boardId&&ML.boards.length) ML.boardId=ML.boards[0].id;
    var b=ML.boards.find(function(x){return x.id===ML.boardId;});
    return '<div class="row-top"><div><h2>بردهای متریال پروژه</h2><div class="material-section-desc">متریال‌ها را برای هر پروژه کنار هم بچین و برآورد اولیه بگیر.</div></div><button class="btn" onclick="MaterialLab.openBoard()">+ برد جدید</button></div>'+
      '<div class="board-layout"><aside class="board-list card">'+(ML.boards.length?ML.boards.map(function(x){
        var p=projects.find(function(y){return y.id===x.project_id;});
        return '<button class="board-list-item '+(b&&b.id===x.id?'active':'')+'" onclick="MaterialLab.selectBoard(\\''+x.id+'\\')"><strong>'+escapeHtml(x.name)+'</strong><span>'+escapeHtml(p?p.title:'بدون پروژه')+'</span></button>';
      }).join(''):'<div class="empty">هنوز بردی ساخته نشده.</div>')+'</aside><section class="board-detail">'+(b?boardDetail(b):'<div class="card"><div class="empty">یک برد بساز تا انتخاب متریال را شروع کنیم.</div></div>')+'</section></div>';
  }

  function boardDetail(b){
    var items=ML.items.filter(function(x){return x.board_id===b.id;});
    var total=items.reduce(function(sum,i){var m=ML.materials.find(function(x){return x.id===i.material_id;});return sum+Number(i.quantity||0)*Number(m&&m.price||0);},0);
    return '<div class="card"><div class="row-top" style="margin-bottom:6px;"><div><span class="eyebrow">MATERIAL BOARD</span><h2 style="margin:3px 0;">'+escapeHtml(b.name)+'</h2><div style="font-size:11px;color:var(--muted);">'+escapeHtml((projects.find(function(p){return p.id===b.project_id;})||{}).title||'بدون پروژه')+'</div></div><div class="board-total"><span>برآورد اولیه</span><strong>'+total.toLocaleString('fa-IR')+' تومان</strong></div></div>'+
      '<div class="board-summary">برآورد بر اساس آخرین قیمت ثبت‌شده است و قبل از خرید باید با شرکت تأیید شود.</div>'+
      '<div class="material-board-add"><select id="ml-board-material"><option value="">+ انتخاب متریال</option>'+ML.materials.map(function(m){return '<option value="'+m.id+'">'+escapeHtml(m.name_fa)+' · '+priceLabel(m)+'</option>';}).join('')+'</select><input id="ml-board-qty" type="number" step="0.01" min="0" placeholder="مقدار"><input id="ml-board-unit" value="مترمربع" placeholder="واحد"><select id="ml-board-status">'+['پیشنهادی','منتخب','تأیید کارفرما','سفارش داده‌شده','اجراشده'].map(function(x){return '<option>'+x+'</option>';}).join('')+'</select><button class="btn" onclick="MaterialLab.addItem(\\''+b.id+'\\')">افزودن</button></div>'+
      '<div class="board-items">'+(items.length?items.map(function(i,n){var m=ML.materials.find(function(x){return x.id===i.material_id;}), line=Number(i.quantity||0)*Number(m&&m.price||0);return '<div class="board-item"><div class="board-item-index">'+(n+1).toLocaleString('fa-IR')+'</div><div class="board-item-main"><strong>'+escapeHtml(m?m.name_fa:'—')+'</strong><div class="material-meta">'+escapeHtml(m?catName(m.category_id):'')+' · '+escapeHtml(m?supName(m.supplier_id):'')+'</div></div><div class="board-item-qty">'+(i.quantity?Number(i.quantity).toLocaleString('fa-IR')+' '+escapeHtml(i.unit||''):'مقدار وارد نشده')+'</div><div class="board-item-status tag">'+escapeHtml(i.status)+'</div><div class="board-item-price">'+(line?line.toLocaleString('fa-IR')+' تومان':'—')+'</div><button class="btn small danger" onclick="MaterialLab.removeItem(\\''+i.id+'\\')">حذف</button></div>';}).join(''):'<div class="empty">متریالی به این برد اضافه نشده.</div>')+'</div></div>';
  }

  function modal(title,body,actions){
    var root=document.getElementById('edit-modal-root');
    root.innerHTML='<div class="overlay" onclick="if(event.target===this)this.remove()"><div class="modal material-form-modal"><div class="row-top"><h3 style="margin:0;">'+title+'</h3><button class="btn small secondary" onclick="this.closest(\\'.overlay\\').remove()">بستن</button></div>'+body+'<div class="modal-actions">'+(actions||'')+'</div></div></div>';
  }
  function input(id,label,value,type,ph){return '<label>'+label+'</label><input id="'+id+'" type="'+(type||'text')+'" value="'+escapeHtml(value==null?'':value)+'" placeholder="'+escapeHtml(ph||'')+'">';}
  function ta(id,label,value){return '<label>'+label+'</label><textarea id="'+id+'" rows="3">'+escapeHtml(value==null?'':value)+'</textarea>';}

  function openMaterial(id){
    if(!admin()) return;
    var m=id?ML.materials.find(function(x){return x.id===id;}):null;
    var body='<div class="material-form-grid">'+input('ml-name','نام فارسی',m&&m.name_fa,'text','مثلاً تراورتن عباس‌آباد')+input('ml-name-en','نام انگلیسی',m&&m.name_en)+
      '<label>دسته</label><select id="ml-cat"><option value="">—</option>'+ML.categories.map(function(c){return '<option value="'+c.id+'" '+(m&&m.category_id===c.id?'selected':'')+'>'+escapeHtml(c.name_fa)+'</option>';}).join('')+'</select>'+
      '<label>شرکت</label><select id="ml-sup"><option value="">—</option>'+ML.suppliers.map(function(s){return '<option value="'+s.id+'" '+(m&&m.supplier_id===s.id?'selected':'')+'>'+escapeHtml(s.name)+'</option>';}).join('')+'</select>'+
      input('ml-brand','برند',m&&m.brand)+input('ml-manufacturer','سازنده',m&&m.manufacturer)+input('ml-code','کد / SKU',m&&m.code)+input('ml-color','رنگ',m&&m.color)+
      input('ml-finish','پرداخت / فینیش',m&&m.finish)+input('ml-dim','ابعاد',m&&m.dimensions)+input('ml-thickness','ضخامت',m&&m.thickness)+input('ml-unit','واحد',m&&m.unit||'مترمربع')+
      input('ml-price','قیمت',m&&m.price,'number','مثلاً 2800000')+input('ml-price-unit','واحد قیمت',m&&m.price_unit||'مترمربع')+input('ml-price-date','تاریخ قیمت',m&&m.price_updated_at,'date')+
      input('ml-price-source','منبع قیمت',m&&m.price_source)+input('ml-stock','وضعیت موجودی',m&&m.stock_status||'نامشخص')+input('ml-image','لینک تصویر',m&&m.image_url,'url')+input('ml-product-url','لینک محصول',m&&m.website_url,'url')+
      input('ml-weight','وزن هر واحد',m&&m.weight_per_unit,'number')+input('ml-water','جذب آب (%)',m&&m.water_absorption,'number')+'</div>'+ta('ml-desc','توضیحات',m&&m.description)+ta('ml-tech','مقاومت / اطلاعات فنی',m&&m.resistance_notes)+ta('ml-notes','یادداشت داخلی',m&&m.notes);
    modal(m?'ویرایش متریال':'افزودن متریال',body,'<button class="btn" onclick="MaterialLab.saveMaterial(\\''+(id||'')+'\\')">ذخیره</button>'+(m?'<button class="btn danger" onclick="MaterialLab.deleteMaterial(\\''+m.id+'\\')">حذف</button>':''));
  }

  async function saveMaterial(id){
    if(!admin()) return;
    var p={name_fa:document.getElementById('ml-name').value.trim(),name_en:document.getElementById('ml-name-en').value.trim()||null,category_id:document.getElementById('ml-cat').value||null,supplier_id:document.getElementById('ml-sup').value||null,brand:document.getElementById('ml-brand').value.trim()||null,manufacturer:document.getElementById('ml-manufacturer').value.trim()||null,code:document.getElementById('ml-code').value.trim()||null,color:document.getElementById('ml-color').value.trim()||null,finish:document.getElementById('ml-finish').value.trim()||null,dimensions:document.getElementById('ml-dim').value.trim()||null,thickness:document.getElementById('ml-thickness').value.trim()||null,unit:document.getElementById('ml-unit').value.trim()||'مترمربع',price:Number(document.getElementById('ml-price').value||0),price_unit:document.getElementById('ml-price-unit').value.trim()||'مترمربع',currency:'تومان',price_updated_at:document.getElementById('ml-price-date').value||null,price_source:document.getElementById('ml-price-source').value.trim()||null,stock_status:document.getElementById('ml-stock').value.trim()||'نامشخص',image_url:document.getElementById('ml-image').value.trim()||null,website_url:document.getElementById('ml-product-url').value.trim()||null,weight_per_unit:document.getElementById('ml-weight').value?Number(document.getElementById('ml-weight').value):null,water_absorption:document.getElementById('ml-water').value?Number(document.getElementById('ml-water').value):null,description:document.getElementById('ml-desc').value.trim()||null,resistance_notes:document.getElementById('ml-tech').value.trim()||null,notes:document.getElementById('ml-notes').value.trim()||null,updated_at:new Date().toISOString()};
    if(!p.name_fa){showToast('نام متریال الزامی است.');return;}
    var r=id?await sb.from('materials').update(p).eq('id',id).select().single():await sb.from('materials').insert([Object.assign({created_by:currentUser.id},p)]).select().single();
    if(r.error){showToast('ذخیره نشد: '+r.error.message);return;}
    var old=id?ML.materials.find(function(x){return x.id===id;}):null;
    if(p.price>0&&(!old||Number(old.price)!==Number(p.price))) await sb.from('material_price_history').insert([{material_id:r.data.id,price:p.price,price_unit:p.price_unit,currency:'تومان',supplier_id:p.supplier_id,source:p.price_source,recorded_at:p.price_updated_at||new Date().toISOString().slice(0,10),created_by:currentUser.id}]);
    document.querySelector('#edit-modal-root .overlay')?.remove();showToast(id?'متریال به‌روزرسانی شد ✅':'متریال اضافه شد ✅');await load();refreshDom();
  }
  async function deleteMaterial(id){if(!admin()||!confirm('این متریال حذف شود؟'))return;var r=await sb.from('materials').delete().eq('id',id);if(r.error){showToast(r.error.message);return;}document.querySelector('#edit-modal-root .overlay')?.remove();await load();refreshDom();}
  function openSupplier(){
    if(!admin())return;
    var body='<div class="material-form-grid">'+input('mls-name','نام شرکت','','text','مثلاً شرکت ...')+input('mls-brand','نام تجاری')+input('mls-contact','شخص تماس')+input('mls-phone','تلفن')+input('mls-mobile','موبایل')+input('mls-wa','واتساپ')+input('mls-email','ایمیل','', 'email')+input('mls-website','وب‌سایت','', 'url')+input('mls-instagram','اینستاگرام')+input('mls-city','شهر')+'</div>'+ta('mls-address','آدرس')+ta('mls-notes','یادداشت');
    modal('افزودن شرکت / تأمین‌کننده',body,'<button class="btn" onclick="MaterialLab.saveSupplier()">ذخیره</button>');
  }
  async function saveSupplier(){
    if(!admin())return;
    var p={name:document.getElementById('mls-name').value.trim(),brand_name:document.getElementById('mls-brand').value.trim()||null,contact_person:document.getElementById('mls-contact').value.trim()||null,phone:document.getElementById('mls-phone').value.trim()||null,mobile:document.getElementById('mls-mobile').value.trim()||null,whatsapp:document.getElementById('mls-wa').value.trim()||null,email:document.getElementById('mls-email').value.trim()||null,website:document.getElementById('mls-website').value.trim()||null,instagram:document.getElementById('mls-instagram').value.trim()||null,city:document.getElementById('mls-city').value.trim()||null,address:document.getElementById('mls-address').value.trim()||null,notes:document.getElementById('mls-notes').value.trim()||null};
    if(!p.name){showToast('نام شرکت الزامی است.');return;}var r=await sb.from('material_suppliers').insert([p]);if(r.error){showToast(r.error.message);return;}document.querySelector('#edit-modal-root .overlay')?.remove();showToast('شرکت اضافه شد ✅');await load();refreshDom();
  }
  async function deleteSupplier(id){if(!admin()||!confirm('شرکت حذف شود؟'))return;var r=await sb.from('material_suppliers').delete().eq('id',id);if(r.error){showToast(r.error.message);return;}await load();refreshDom();}
  function openCatalog(){
    if(!admin())return;
    var body='<div class="material-form-grid">'+input('mlc-title','عنوان کاتالوگ / کتاب','','text','کاتالوگ محصولات 2026')+
      '<label>شرکت</label><select id="mlc-sup"><option value="">—</option>'+ML.suppliers.map(function(s){return '<option value="'+s.id+'">'+escapeHtml(s.name)+'</option>';}).join('')+'</select>'+
      '<label>نوع</label><select id="mlc-kind"><option>کاتالوگ</option><option>کتاب</option><option>بروشور</option><option>دیتاشیت</option></select>'+input('mlc-pub','ناشر / سازنده')+input('mlc-cat','دسته')+input('mlc-year','سال','','number')+input('mlc-cover','لینک جلد','','url')+input('mlc-file','لینک فایل','','url')+input('mlc-loc','محل نگهداری نسخه فیزیکی','','text','قفسه 2 / دفتر')+'</div>'+ta('mlc-desc','توضیحات')+ta('mlc-notes','یادداشت');
    modal('افزودن کاتالوگ / کتاب',body,'<button class="btn" onclick="MaterialLab.saveCatalog()">ذخیره</button>');
  }
  async function saveCatalog(){
    if(!admin())return;
    var p={title:document.getElementById('mlc-title').value.trim(),supplier_id:document.getElementById('mlc-sup').value||null,catalog_kind:document.getElementById('mlc-kind').value||'کاتالوگ',publisher:document.getElementById('mlc-pub').value.trim()||null,category:document.getElementById('mlc-cat').value.trim()||null,year:document.getElementById('mlc-year').value?Number(document.getElementById('mlc-year').value):null,cover_url:document.getElementById('mlc-cover').value.trim()||null,file_url:document.getElementById('mlc-file').value.trim()||null,physical_location:document.getElementById('mlc-loc').value.trim()||null,description:document.getElementById('mlc-desc').value.trim()||null,notes:document.getElementById('mlc-notes').value.trim()||null};
    if(!p.title){showToast('عنوان کاتالوگ الزامی است.');return;}var r=await sb.from('material_catalogs').insert([p]);if(r.error){showToast(r.error.message);return;}document.querySelector('#edit-modal-root .overlay')?.remove();showToast('کاتالوگ اضافه شد ✅');await load();refreshDom();
  }
  async function deleteCatalog(id){if(!admin()||!confirm('کاتالوگ حذف شود؟'))return;var r=await sb.from('material_catalogs').delete().eq('id',id);if(r.error){showToast(r.error.message);return;}await load();refreshDom();}
  function openCategory(){if(!admin())return;var body='<div class="material-form-grid">'+input('mlcat-name','نام فارسی','','text','مثلاً سنگ')+input('mlcat-name-en','نام انگلیسی')+input('mlcat-icon','آیکون / ایموجی','','text','🧱')+input('mlcat-sort','ترتیب','0','number')+'</div>'+ta('mlcat-desc','توضیحات');modal('افزودن دسته‌بندی',body,'<button class="btn" onclick="MaterialLab.saveCategory()">ذخیره</button>');}
  async function saveCategory(){if(!admin())return;var p={name_fa:document.getElementById('mlcat-name').value.trim(),name_en:document.getElementById('mlcat-name-en').value.trim()||null,icon:document.getElementById('mlcat-icon').value.trim()||'🧱',sort_order:Number(document.getElementById('mlcat-sort').value||0),description:document.getElementById('mlcat-desc').value.trim()||null};if(!p.name_fa){showToast('نام دسته الزامی است.');return;}var r=await sb.from('material_categories').insert([p]);if(r.error){showToast(r.error.message);return;}document.querySelector('#edit-modal-root .overlay')?.remove();showToast('دسته اضافه شد ✅');await load();refreshDom();}
  async function deleteCategory(id){if(!admin()||!confirm('دسته حذف شود؟'))return;var r=await sb.from('material_categories').delete().eq('id',id);if(r.error){showToast(r.error.message);return;}await load();refreshDom();}
  function openBoard(){
    var body=input('mlb-name','نام برد','','text','مثلاً Meybod Cafe — Material Board')+'<label>پروژه</label><select id="mlb-project"><option value="">بدون پروژه</option>'+projects.map(function(p){return '<option value="'+p.id+'">'+escapeHtml(p.title)+'</option>';}).join('')+'</select>'+ta('mlb-desc','توضیحات');
    modal('ساخت برد متریال',body,'<button class="btn" onclick="MaterialLab.saveBoard()">ساخت برد</button>');
  }
  async function saveBoard(){
    var p={name:document.getElementById('mlb-name').value.trim(),project_id:document.getElementById('mlb-project').value||null,description:document.getElementById('mlb-desc').value.trim()||null,created_by:currentUser.id};
    if(!p.name){showToast('نام برد الزامی است.');return;}var r=await sb.from('material_boards').insert([p]).select().single();if(r.error){showToast(r.error.message);return;}ML.boardId=r.data.id;ML.view='boards';document.querySelector('#edit-modal-root .overlay')?.remove();showToast('برد ساخته شد ✅');await load();refreshDom();
  }
  async function addItem(boardId){
    var mid=document.getElementById('ml-board-material').value;if(!mid){showToast('اول متریال را انتخاب کن.');return;}var qty=document.getElementById('ml-board-qty').value;var unit=document.getElementById('ml-board-unit').value||'';var status=document.getElementById('ml-board-status').value;var max=-1;ML.items.filter(function(i){return i.board_id===boardId;}).forEach(function(i){max=Math.max(max,Number(i.position||0));});var r=await sb.from('material_board_items').insert([{board_id:boardId,material_id:mid,quantity:qty?Number(qty):null,unit:unit,status:status,position:max+1}]);if(r.error){showToast(r.error.message);return;}await load();refreshDom();}
  async function removeItem(id){if(!confirm('این متریال از برد حذف شود؟'))return;var r=await sb.from('material_board_items').delete().eq('id',id);if(r.error){showToast(r.error.message);return;}await load();refreshDom();}
  async function favorite(id){var ex=ML.favorites.indexOf(id)>=0;var r=ex?await sb.from('material_favorites').delete().eq('user_id',currentUser.id).eq('material_id',id):await sb.from('material_favorites').insert([{user_id:currentUser.id,material_id:id}]);if(r.error){showToast(r.error.message);return;}await load();refreshDom();}
  function details(id){
    var m=ML.materials.find(function(x){return x.id===id;});if(!m)return;var s=sup(m.supplier_id),hist=ML.prices.filter(function(x){return x.material_id===id;}).slice(0,6),img=safeUrl(m.image_url);
    var body='<div class="row-top"><div><span class="eyebrow">MATERIAL</span><h3 style="font-size:20px;margin:3px 0;">'+escapeHtml(m.name_fa)+'</h3>'+(m.name_en?'<div class="material-en">'+escapeHtml(m.name_en)+'</div>':'')+'</div></div>'+
      (img?'<div class="material-detail-image"><img src="'+escapeHtml(img)+'" alt=""></div>':'')+
      '<div class="material-detail-price">'+priceLabel(m)+' <span>· آخرین قیمت '+escapeHtml(m.price_updated_at||'ثبت نشده')+'</span></div>'+
      '<div class="material-spec-grid"><div><span>دسته</span><strong>'+escapeHtml(catName(m.category_id))+'</strong></div><div><span>شرکت</span><strong>'+escapeHtml(s?s.name:'—')+'</strong></div><div><span>برند</span><strong>'+escapeHtml(m.brand||'—')+'</strong></div><div><span>پرداخت</span><strong>'+escapeHtml(m.finish||'—')+'</strong></div><div><span>رنگ</span><strong>'+escapeHtml(m.color||'—')+'</strong></div><div><span>ابعاد</span><strong>'+escapeHtml(m.dimensions||'—')+'</strong></div><div><span>ضخامت</span><strong>'+escapeHtml(m.thickness||'—')+'</strong></div><div><span>کاربرد</span><strong>'+escapeHtml(m.application_type||'—')+'</strong></div></div>'+
      (m.description?'<div class="material-detail-text">'+escapeHtml(m.description)+'</div>':'')+(m.resistance_notes?'<div class="material-detail-note"><strong>مقاومت / نکته فنی:</strong> '+escapeHtml(m.resistance_notes)+'</div>':'')+
      '<div class="supplier-contact-box"><div><strong>🏢 '+escapeHtml(s?s.name:'شرکت ثبت نشده')+'</strong>'+(s&&s.contact_person?' · '+escapeHtml(s.contact_person):'')+'</div><div class="supplier-actions">'+((s&&(s.phone||s.mobile))?'<a class="btn small" href="tel:'+escapeHtml(phone(s.phone||s.mobile))+'">📞 تماس</a>':'')+(s&&s.whatsapp?'<a class="btn small secondary" target="_blank" rel="noopener" href="'+escapeHtml(wa(s.whatsapp))+'">واتساپ</a>':'')+(s&&safeUrl(s.website)?'<a class="btn small secondary" target="_blank" rel="noopener" href="'+escapeHtml(safeUrl(s.website))+'">وب‌سایت</a>':'')+'</div></div>'+
      '<div class="modal-section"><h4>🎨 افزودن به برد پروژه</h4><div class="row"><select id="mld-board"><option value="">انتخاب برد...</option>'+ML.boards.map(function(b){return '<option value="'+b.id+'">'+escapeHtml(b.name)+'</option>';}).join('')+'</select><button class="btn" onclick="MaterialLab.addDetailBoard(\\''+m.id+'\\')">افزودن</button></div></div>'+
      '<div class="modal-section"><h4>📞 درخواست قیمت</h4><div class="row"><input id="mld-qty" type="number" step="0.01" min="0" placeholder="مقدار"><input id="mld-unit" value="'+escapeHtml(m.unit||'مترمربع')+'" placeholder="واحد"><select id="mld-project"><option value="">پروژه (اختیاری)</option>'+projects.map(function(p){return '<option value="'+p.id+'">'+escapeHtml(p.title)+'</option>';}).join('')+'</select></div><textarea id="mld-msg" rows="2" placeholder="توضیحات برای شرکت"></textarea><button class="btn small" onclick="MaterialLab.quote(\\''+m.id+'\\')">ثبت درخواست قیمت</button></div>'+
      (hist.length?'<div class="modal-section"><h4>💰 آخرین قیمت‌ها</h4><div class="price-history-mini">'+hist.map(function(x){return '<div><span>'+escapeHtml(x.recorded_at)+'</span><strong>'+money(x.price)+' تومان</strong></div>';}).join('')+'</div></div>':'');
    var actions=(m.website_url&&safeUrl(m.website_url)?'<a class="btn small secondary" target="_blank" rel="noopener" href="'+escapeHtml(safeUrl(m.website_url))+'">صفحه محصول</a>':'')+(admin()?'<button class="btn small secondary" onclick="this.closest(\\'.overlay\\').remove();MaterialLab.openMaterial(\\''+m.id+'\\')">ویرایش</button>':'');
    modal('جزئیات متریال',body,actions);
  }
  async function addDetailBoard(mid){var bid=document.getElementById('mld-board').value;if(!bid){showToast('یک برد انتخاب کن.');return;}var max=-1;ML.items.filter(function(i){return i.board_id===bid;}).forEach(function(i){max=Math.max(max,Number(i.position||0));});var r=await sb.from('material_board_items').insert([{board_id:bid,material_id:mid,position:max+1,unit:(ML.materials.find(function(m){return m.id===mid;})||{}).unit||'مترمربع'}]);if(r.error){showToast(r.error.message);return;}document.querySelector('#edit-modal-root .overlay')?.remove();ML.view='boards';await load();refreshDom();}
  async function quote(mid){var m=ML.materials.find(function(x){return x.id===mid;}),qty=document.getElementById('mld-qty').value,unit=document.getElementById('mld-unit').value||m.unit||'',pid=document.getElementById('mld-project').value||null,msg=document.getElementById('mld-msg').value.trim()||null;var r=await sb.from('material_quote_requests').insert([{material_id:mid,project_id:pid,supplier_id:m.supplier_id,requested_by:currentUser.id,quantity:qty?Number(qty):null,unit:unit,message:msg,status:'جدید'}]);if(r.error){showToast(r.error.message);return;}document.querySelector('#edit-modal-root .overlay')?.remove();showToast('درخواست قیمت ثبت شد ✅');await load();refreshDom();}

  var originalSwitch = window.switchSection;
  window.switchSection = function(id){
    if(originalSwitch) originalSwitch(id);
    if(id==='material-lab'){
      var s=document.getElementById('section-material-lab');
      if(s){s.innerHTML='<div class="card"><div class="empty">در حال آماده‌سازی Material Lab...</div></div>';load().then(function(){if(window.activeSectionId==='material-lab'||!s.classList.contains('hidden'))s.innerHTML=render();}).catch(function(e){s.innerHTML='<div class="card"><div class="error-msg">خطا در بارگذاری Material Lab: '+escapeHtml(e.message||String(e))+'</div></div>';});}
    }
  };

  if(typeof buildNav==='function'){ try{buildNav(typeof activeSectionId!=='undefined'?activeSectionId:'dashboard');}catch(e){} }

  window.MaterialLab = {
    setView:function(v){ML.view=v;refreshDom();},
    search:function(v){ML.query=v;clearTimeout(timer);timer=setTimeout(refreshDom,120);},
    filter:function(k,v){ML[k]=v;ML.view='materials';refreshDom();},
    filterSupplier:function(id){ML.supplier=id;ML.view='materials';refreshDom();},
    selectBoard:function(id){ML.boardId=id;ML.view='boards';refreshDom();},
    refresh:function(){return load().then(refreshDom);},
    openMaterial:openMaterial,saveMaterial:saveMaterial,deleteMaterial:deleteMaterial,
    openSupplier:openSupplier,saveSupplier:saveSupplier,deleteSupplier:deleteSupplier,
    openCatalog:openCatalog,saveCatalog:saveCatalog,deleteCatalog:deleteCatalog,
    openCategory:openCategory,saveCategory:saveCategory,deleteCategory:deleteCategory,
    openBoard:openBoard,saveBoard:saveBoard,addItem:addItem,removeItem:removeItem,
    favorite:favorite,details:details,addDetailBoard:addDetailBoard,quote:quote
  };
})();

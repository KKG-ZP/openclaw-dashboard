import{D as b}from"./index-B7Gx8lv1.js";class v extends b{constructor(){super(),this._drag=null,this._masonryEnabled=!1,this._layoutRAFPending=!1,this._lastCardWidths=new Map,this._masonryGap=20,this._masonryMinCol=350,this._masonryMaxCols=4}setupDragAndDrop(){this.loadLayout();const t=document.querySelector(".grid");t&&(this._injectMasonryStyles(),this._createResetButton(),this._initMasonry(t),this._bindDragEvents(t))}_bindDragEvents(t){t||(t=document.querySelector(".grid")),t&&t.querySelectorAll(":scope > .card[data-card-id]").forEach(e=>{const s=e.querySelector(".card-header");if(!s)return;s._dragHandler&&s.removeEventListener("mousedown",s._dragHandler);const o=i=>this._onMouseDown(i,e,t);this.addListener(s,"mousedown",o),s._dragHandler=o})}_injectMasonryStyles(){if(document.getElementById("masonry-drag-styles"))return;const t=document.createElement("style");t.id="masonry-drag-styles",t.textContent=`
      /* --- 瀑布流容器 --- */
      .grid.masonry-active {
        display: block !important;
        position: relative;
      }
      .grid.masonry-active > .card[data-card-id] {
        position: absolute;
        box-sizing: border-box;
        transition: top 0.35s cubic-bezier(.4,0,.2,1), left 0.35s cubic-bezier(.4,0,.2,1),
                    transform 0.3s, box-shadow 0.3s;
      }
      /* 首次布局跳过动画 */
      .grid.masonry-no-transition > .card[data-card-id] {
        transition: none !important;
      }
      /* 拖拽过程中其他卡片也跳过动画（即时响应） */
      .grid.masonry-active.is-dragging > .card[data-card-id] {
        transition: none !important;
      }

      /* --- 拖拽手柄 --- */
      .grid > .card > .card-header { cursor: grab; user-select: none; }
      .grid > .card > .card-header:active { cursor: grabbing; }
      .grid.masonry-disabled > .card > .card-header { cursor: default; user-select: auto; }

      /* --- 浮动卡片 --- */
      .card.drag-floating {
        position: fixed !important;
        z-index: 10000 !important;
        pointer-events: none !important;
        box-shadow: 0 20px 60px rgba(0,0,0,0.25), 0 0 0 2px rgba(59,130,246,0.5) !important;
        transform: rotate(1.5deg) scale(1.03) !important;
        opacity: 0.92;
        transition: transform 0.1s, box-shadow 0.1s !important;
      }

      /* --- 占位符 --- */
      .drag-placeholder {
        position: absolute;
        box-sizing: border-box;
        border: 2.5px dashed rgba(59,130,246,0.45);
        border-radius: 12px;
        background: repeating-linear-gradient(
          -45deg,
          rgba(59,130,246,0.03),
          rgba(59,130,246,0.03) 8px,
          rgba(59,130,246,0.07) 8px,
          rgba(59,130,246,0.07) 16px
        );
        transition: top 0.15s ease, left 0.15s ease;
      }

      /* --- 重置按钮 --- */
      .layout-reset-btn {
        position: fixed; bottom: 16px; left: 16px; z-index: 999;
        background: var(--accent, #3b82f6); color: white;
        border: none; padding: 6px 14px; border-radius: 6px;
        font-size: 0.8em; cursor: pointer;
        opacity: 0; pointer-events: none; transition: opacity 0.2s;
      }
      .layout-reset-btn.visible { opacity: 1; pointer-events: auto; }
      .layout-reset-btn:hover { filter: brightness(1.1); }

      /* --- 拖拽中禁止选中文字 --- */
      body.is-dragging-card { user-select: none !important; cursor: grabbing !important; }
    `,document.head.appendChild(t)}_createResetButton(){if(document.getElementById("layoutResetBtn"))return;const t=document.createElement("button");t.id="layoutResetBtn",t.className="layout-reset-btn",t.textContent="↩ 重置布局",t.title="恢复默认卡片排列顺序",this.addListener(t,"click",()=>{localStorage.removeItem("cardLayout"),window.location.reload()}),document.body.appendChild(t),localStorage.getItem("cardLayout")&&t.classList.add("visible")}_initMasonry(t){this._masonryEnabled=!0,t.classList.add("masonry-active","masonry-no-transition"),this.layoutMasonry(),requestAnimationFrame(()=>{requestAnimationFrame(()=>{t.classList.remove("masonry-no-transition")})}),this._resizeHandler=this._debounce(()=>this.layoutMasonry(),80),this.addListener(window,"resize",this._resizeHandler),this._contentObserver=this.addObserver(new ResizeObserver(e=>{if(this._drag&&this._drag.activated)return;let s=!1;for(const o of e){const i=o.target,r=this._lastCardWidths.get(i),n=o.contentRect.height;if(!r||Math.abs(r.h-n)>1){s=!0;break}}s&&this._scheduleLayout()})),t.querySelectorAll(":scope > .card[data-card-id]").forEach(e=>{this._contentObserver.observe(e)}),this.addListener(window,"load",()=>this.layoutMasonry())}_scheduleLayout(){this._layoutRAFPending||(this._layoutRAFPending=!0,requestAnimationFrame(()=>{this._layoutRAFPending=!1,this.layoutMasonry()}))}layoutMasonry(){const t=document.querySelector(".grid");if(!t||!this._masonryEnabled)return;if(window.matchMedia("(max-width: 1024px)").matches){this._disableMasonryLayout(t);return}if(window.matchMedia("(min-width: 1200px)").matches){this._enableMasonryLayout(t),this._layoutDesktopTwoColumn(t);return}this._enableMasonryLayout(t);const e=t.clientWidth;if(e<=0)return;const s=this._masonryGap;let o=Math.max(1,Math.floor((e+s)/(this._masonryMinCol+s)));o=Math.min(o,this._masonryMaxCols);const i=(e-(o-1)*s)/o,r=new Array(o).fill(0),n=Array.from(t.querySelectorAll(":scope > .card[data-card-id]:not(.drag-floating), :scope > .drag-placeholder"));n.forEach(d=>{d.style.height="auto"}),n.forEach(d=>{const c=(d.classList.contains("card-wide")||d.classList.contains("drag-placeholder-wide"))&&o>=2?2:1,y=i*c+s*(c-1);d.style.width=y+"px";let h=0,l=1/0;for(let a=0;a<=o-c;a++){let u=0;for(let p=a;p<a+c;p++)u=Math.max(u,r[p]);u<l&&(l=u,h=a)}d.style.left=h*(i+s)+"px",d.style.top=l+"px";const g=d.offsetHeight;for(let a=h;a<h+c;a++)r[a]=l+g+s;this._lastCardWidths.set(d,{w:y,h:g})}),t.style.height=Math.max(...r,0)+"px"}_layoutDesktopTwoColumn(t){const e=t.clientWidth;if(e<=0)return;const s=16,o=16,i=16,r=Math.max(260,(e-s)*.25),n=Math.max(0,e-s-r),d=a=>t.querySelector(`:scope > .card[data-card-id="${a}"]`),f=[d("system-overview"),d("current-tasks"),d("task-history")].filter(Boolean),c=[d("agents"),d("model-usage"),d("skills-usage")].filter(Boolean),y=Array.from(t.querySelectorAll(":scope > .card[data-card-id]"));let h=0,l=0;y.forEach(a=>{a.style.height="auto",a.style.gridColumn="auto",a.style.gridRow="auto"}),f.forEach((a,u)=>{a.style.width=`${r}px`,a.style.left="0px",a.style.top=`${h}px`,h+=a.offsetHeight+(u<f.length-1?i:0),this._lastCardWidths.set(a,{w:r,h:a.offsetHeight})}),c.forEach((a,u)=>{a.style.width=`${n}px`,a.style.left=`${r+s}px`,a.style.top=`${l}px`,l+=a.offsetHeight+(u<c.length-1?o:0),this._lastCardWidths.set(a,{w:n,h:a.offsetHeight})});const g=new Set([...f,...c]);y.forEach(a=>{g.has(a)||(a.style.width=`${n}px`,a.style.left=`${r+s}px`,a.style.top=`${l}px`,l+=a.offsetHeight+o,this._lastCardWidths.set(a,{w:n,h:a.offsetHeight}))}),t.style.height=`${Math.max(h,l)}px`}_disableMasonryLayout(t){t.classList.remove("masonry-active","masonry-no-transition","is-dragging"),t.classList.add("masonry-disabled"),t.style.height="",t.querySelectorAll(":scope > .card[data-card-id], :scope > .drag-placeholder").forEach(e=>{e.classList.remove("drag-floating"),e.style.position="",e.style.left="",e.style.top="",e.style.width="",e.style.height=""})}_enableMasonryLayout(t){t.classList.remove("masonry-disabled"),t.classList.contains("masonry-active")||t.classList.add("masonry-active")}_debounce(t,e){let s;return(...o)=>{clearTimeout(s),s=setTimeout(()=>t.apply(this,o),e)}}_onMouseDown(t,e,s){t.button===0&&(window.matchMedia("(max-width: 1024px), (min-width: 1200px)").matches||t.target.closest("input, select, button, textarea, a, .search-input, .btn-small")||(t.preventDefault(),this._drag={card:e,grid:s,startX:t.clientX,startY:t.clientY,activated:!1},this._boundMM=o=>this._onMouseMove(o),this._boundMU=o=>this._onMouseUp(o),document.addEventListener("mousemove",this._boundMM),document.addEventListener("mouseup",this._boundMU)))}_onMouseMove(t){const e=this._drag;if(e){if(!e.activated){if(Math.abs(t.clientX-e.startX)<5&&Math.abs(t.clientY-e.startY)<5)return;this._activateDrag(e,t)}e.card.style.left=t.clientX-e.offsetX+"px",e.card.style.top=t.clientY-e.offsetY+"px",this._updatePlaceholder(t,e)}}_onMouseUp(){document.removeEventListener("mousemove",this._boundMM),document.removeEventListener("mouseup",this._boundMU);const t=this._drag;if(!t||(this._drag=null,!t.activated))return;const{card:e,grid:s,placeholder:o}=t;o&&o.parentNode&&(s.insertBefore(e,o),o.remove()),e.classList.remove("drag-floating"),e.style.cssText="",s.classList.remove("is-dragging"),document.body.classList.remove("is-dragging-card"),this.layoutMasonry(),this.saveLayout()}_activateDrag(t,e){t.activated=!0;const{card:s,grid:o}=t,i=s.getBoundingClientRect();t.offsetX=e.clientX-i.left,t.offsetY=e.clientY-i.top;const r=document.createElement("div");r.className="drag-placeholder",s.classList.contains("card-wide")&&r.classList.add("drag-placeholder-wide","card-wide"),r.style.height=i.height+"px",t.placeholder=r,t.lastPHIndex=-1,s.parentNode.insertBefore(r,s),s.classList.add("drag-floating"),s.style.width=i.width+"px",s.style.height=i.height+"px",s.style.left=i.left+"px",s.style.top=i.top+"px",o.classList.add("is-dragging"),document.body.classList.add("is-dragging-card"),this.layoutMasonry()}_updatePlaceholder(t,e){const{grid:s,placeholder:o}=e,i=Array.from(s.querySelectorAll(":scope > .card[data-card-id]:not(.drag-floating), :scope > .drag-placeholder"));let r=null,n=!0,d=1/0;for(const h of i){if(h===o)continue;const l=h.getBoundingClientRect(),g=l.left+l.width/2,a=l.top+l.height/2,u=t.clientX-g,p=t.clientY-a,m=u*u+p*p;m<d&&(d=m,r=h,n=p<0||Math.abs(p)<l.height/3&&u<0)}if(!r)return;const c=Array.from(s.children).indexOf(r),y=n?c:c+1;y!==e.lastPHIndex&&(e.lastPHIndex=y,n?s.insertBefore(o,r):s.insertBefore(o,r.nextSibling),this.layoutMasonry())}saveLayout(){const t=document.querySelector(".grid");if(!t)return;const e=Array.from(t.querySelectorAll(":scope > .card[data-card-id]")).map(o=>o.dataset.cardId);localStorage.setItem("cardLayout",JSON.stringify(e));const s=document.getElementById("layoutResetBtn");s&&s.classList.add("visible")}loadLayout(){try{const t=localStorage.getItem("cardLayout");if(!t)return;const e=JSON.parse(t),s=document.querySelector(".grid");if(!s||!Array.isArray(e))return;const o={};s.querySelectorAll(":scope > .card[data-card-id]").forEach(r=>{o[r.dataset.cardId]=r});const i=new Set;e.forEach(r=>{const n=o[r];n&&(s.appendChild(n),i.add(r))}),s.querySelectorAll(":scope > .card[data-card-id]").forEach(r=>{const n=r.dataset.cardId;i.has(n)||(s.appendChild(r),i.add(n))}),i.size!==e.length&&this.saveLayout()}catch(t){console.error("加载布局失败:",t)}}}export{v as DragDropManager};

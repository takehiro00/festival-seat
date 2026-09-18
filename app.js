'use strict';
const queue=[];
const layout=document.querySelector('#layout');
const dialog=document.querySelector('#confirm');
const seats=new Map();
let pending=null;
let seatNumber=0;
const label=id=>'席 '+String(id).padStart(2,'0');
for(let row=0;row<3;row++){
 const line=document.createElement('div');line.className='row';
 for(let col=0;col<3;col++){
  const count=row===2?4:2;const group=String.fromCharCode(65+row*3+col);
  const cluster=document.createElement('div');cluster.className='cluster';
  const heading=document.createElement('div');heading.className='cluster-label';heading.innerHTML='<b>'+group+'</b><span>'+count+'席</span>';
  const table=document.createElement('div');table.className='table'+(row===1?' vertical':'');
  for(let k=0;k<count;k++){
   const id=++seatNumber;const button=document.createElement('button');button.type='button';button.className='seat';button.dataset.seat=id;
   button.innerHTML='<span class="id">'+label(id)+'</span><span class="rank">空席</span>';
   let timer=null,held=false,start=null;
   const clear=()=>{clearTimeout(timer);timer=null;button.classList.remove('holding')};
   button.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;held=false;start={x:e.clientX,y:e.clientY};if(!queue.includes(id))return;button.classList.add('holding');timer=setTimeout(()=>{held=true;clear();askComplete(id)},550)});
   button.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>12){held=true;clear()}});
   button.addEventListener('pointerup',clear);button.addEventListener('pointercancel',()=>{held=true;clear()});button.addEventListener('pointerleave',clear);
   button.addEventListener('contextmenu',e=>e.preventDefault());
   button.addEventListener('click',e=>{if(held){held=false;return}if(queue.includes(id)){if(e.detail===0)askComplete(id);else announce(label(id)+'は提供待ちです。長押しで完了できます。')}else addSeat(id)});
   seats.set(id,button);table.append(button);
  }
  cluster.append(heading,table);line.append(cluster);
 }
 layout.append(line);
}
function announce(message){document.querySelector('#status').textContent=message}
function render(){
 for(const [id,button] of seats){const index=queue.indexOf(id);button.className='seat'+(index>=0?' busy':'')+(index===0?' first':'');button.querySelector('.rank').textContent=index<0?'空席':index+1;button.setAttribute('aria-label',label(id)+(index<0?'、空席。タップで受付':'、提供順 '+(index+1)+'。長押しまたはEnterで完了確認'));}
 document.querySelector('#waiting').textContent=queue.length;
 document.querySelector('#next').textContent=queue.length?label(queue[0])+' に提供':'まだお待ちの席はありません';
 document.querySelector('#free').textContent='空き '+(24-queue.length)+'席';
}
function addSeat(id){if(!seats.has(id))throw Error('席番号が正しくありません');if(queue.includes(id))throw Error('受付済みです');queue.push(id);render();announce(label(id)+'を '+queue.length+'番で受け付けました');return {seat:id,order:queue.length}}
function askComplete(id){if(!queue.includes(id))return;pending=id;document.querySelector('#modal-seat').textContent=label(id)+' / 提供順 '+(queue.indexOf(id)+1);dialog.showModal();}
function completeSeat(id){const index=queue.indexOf(id);if(index<0)throw Error('提供待ちの席ではありません');queue.splice(index,1);render();announce(label(id)+'への提供が完了しました');return {seat:id,waiting:queue.length}}
document.querySelector('#complete').addEventListener('click',()=>{if(pending!==null&&queue.includes(pending))completeSeat(pending);dialog.close();});
dialog.addEventListener('close',()=>{if(pending!==null)seats.get(pending)?.focus();pending=null});
window.addEventListener('beforeunload',e=>{if(queue.length){e.preventDefault();e.returnValue=''}});
render();
if(document.modelContext?.registerTool){
 const definitions=[{name:'read_seat_queue',description:'現在の提供待ちの席と順番を取得する',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({waiting:queue.map((seat,index)=>({seat,order:index+1})),free:24-queue.length})},{name:'register_seat',description:'空席を受け付け、提供順の最後に追加する',inputSchema:{type:'object',properties:{seat:{type:'integer',minimum:1,maximum:24}},required:['seat'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>addSeat(input.seat)},{name:'open_completion_confirmation',description:'提供完了の確認画面を開く。完了処理は利用者の確認後に行う',inputSchema:{type:'object',properties:{seat:{type:'integer',minimum:1,maximum:24}},required:['seat'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!queue.includes(input.seat))throw Error('提供待ちの席ではありません');askComplete(input.seat);return {confirmationOpened:true}}}];
 for(const tool of definitions){try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{})}catch{}}
}

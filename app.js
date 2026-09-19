'use strict';
const queue=[];
const served=new Set();
let tally=0;
const storageKey='festival-seat-queue:v1:'+location.pathname.replace(/\/index\.html$/, '/');
let saved=true;
function storageNotice(message){document.querySelector('#storage-status').textContent=message}
function restoreQueue(){
 try{
  const raw=localStorage.getItem(storageKey);
  if(raw===null)return;
  const data=JSON.parse(raw);
  if(![1,2].includes(data.version)||!Array.isArray(data.queue)||data.queue.length>24||data.queue.some(id=>!Number.isInteger(id)||id<1||id>24)||new Set(data.queue).size!==data.queue.length)throw Error('Invalid saved queue');
  const completed=data.version===2?data.served:[];
  if(!Array.isArray(completed)||completed.some(id=>!Number.isInteger(id)||id<1||id>24||data.queue.includes(id))||new Set(completed).size!==completed.length)throw Error('Invalid served seats');
  if(data.tally!==undefined&&(!Number.isSafeInteger(data.tally)||data.tally<0))throw Error('Invalid counter');
  tally=data.tally??0;
  queue.push(...data.queue);
  completed.forEach(id=>served.add(id));
 }catch{
  saved=false;
  storageNotice('保存データを読み込めませんでした。現在の席と順番を確認してください。');
 }
}
function saveQueue(){
 try{
  localStorage.setItem(storageKey,JSON.stringify({version:2,queue,served:[...served],tally}));
  saved=true;
  storageNotice('この端末に自動保存済み。再読み込み後も提供順・着席状態・カウンターを復元します。');
 }catch{
  saved=false;
  storageNotice('自動保存できません。この画面を閉じずに、席と順番を控えてください。');
 }
}
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
   let lastTap=null,ignoreUntil=0;
   button.addEventListener('contextmenu',e=>e.preventDefault());
   button.addEventListener('click',e=>{
    const now=Date.now();
    if(now<ignoreUntil)return;
    if(!queue.includes(id)&&!served.has(id)){
     addSeat(id);lastTap=null;ignoreUntil=now+450;return;
    }
    if(e.detail===0){lastTap=null;askComplete(id);return;}
    if(lastTap!==null&&now-lastTap<=450){lastTap=null;askComplete(id);}
    else {lastTap=now;announce(label(id)+(served.has(id)?'は提供済み・着席中です。ダブルタップで退席確認。':'は提供待ちです。ダブルタップで提供完了確認。'));}
   });
   seats.set(id,button);table.append(button);
  }
  cluster.append(heading,table);line.append(cluster);
 }
 layout.append(line);
}
function announce(message){document.querySelector('#status').textContent=message}
function render(){
 for(const [id,button] of seats){
  const index=queue.indexOf(id),done=served.has(id);
  button.className='seat'+(done?' served':index>=0?' busy':'')+(index===0?' first':'');
  button.querySelector('.rank').textContent=done?'提供済':index<0?'空席':index+1;
  button.setAttribute('aria-label',label(id)+(done?'、提供済み・着席中。ダブルタップまたはEnterで退席確認':index<0?'、空席。タップで受付':'、提供順 '+(index+1)+'。ダブルタップまたはEnterで提供完了確認'));
 }
 document.querySelector('#waiting').textContent=queue.length;
 document.querySelector('#next').textContent=queue.length?label(queue[0])+' に提供':'まだお待ちの席はありません';
 document.querySelector('#free').textContent='空き '+(24-queue.length-served.size)+'席';
}
function addSeat(id){if(!seats.has(id))throw Error('席番号が正しくありません');if(queue.includes(id)||served.has(id))throw Error('着席中です');queue.push(id);saveQueue();render();announce(label(id)+'を '+queue.length+'番で受け付けました');return {seat:id,order:queue.length}}
function askComplete(id){
 if(!queue.includes(id)&&!served.has(id))return;
 pending={id,action:served.has(id)?'depart':'serve'};
 const departing=pending.action==='depart';
 document.querySelector('#modal-seat').textContent=label(id)+(departing?' / 提供済み・着席中':' / 提供順 '+(queue.indexOf(id)+1));
 document.querySelector('#modal-title').textContent=departing?'退席しましたか？':'提供は完了しましたか？';
 document.querySelector('#modal-description').textContent=departing?'退席を記録して、この席を空席に戻します。':'提供済みにして、後の提供順を繰り上げます。この席は着席中のまま残ります。';
 document.querySelector('#complete').textContent=departing?'退席・空席に戻す':'提供完了・着席中にする';
 dialog.showModal();
}
function departSeat(id){if(!served.has(id))throw Error('提供済みの席ではありません');served.delete(id);saveQueue();render();announce(label(id)+'が退席し、空席になりました');return {seat:id,status:'empty'}}
function completeSeat(id){const index=queue.indexOf(id);if(index<0)throw Error('提供待ちの席ではありません');queue.splice(index,1);served.add(id);saveQueue();render();announce(label(id)+'への提供が完了しました');return {seat:id,waiting:queue.length}}
document.querySelector('#complete').addEventListener('click',()=>{if(pending!==null){if(pending.action==='serve'&&queue.includes(pending.id))completeSeat(pending.id);else if(pending.action==='depart'&&served.has(pending.id))departSeat(pending.id);}dialog.close();});
dialog.addEventListener('close',()=>{if(pending!==null)seats.get(pending.id)?.focus();pending=null});
window.addEventListener('beforeunload',e=>{if(!saved){e.preventDefault();e.returnValue=''}});
restoreQueue();
render();
if(queue.length||served.size)announce('提供待ち '+queue.length+'席・提供済み '+served.size+'席を復元しました');
if(document.modelContext?.registerTool){
 const definitions=[{name:'read_seat_queue',description:'現在の提供待ちの席と順番を取得する',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({waiting:queue.map((seat,index)=>({seat,order:index+1})),served:[...served],free:24-queue.length-served.size})},{name:'register_seat',description:'空席を受け付け、提供順の最後に追加する',inputSchema:{type:'object',properties:{seat:{type:'integer',minimum:1,maximum:24}},required:['seat'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>addSeat(input.seat)},{name:'open_completion_confirmation',description:'提供完了の確認画面を開く。完了処理は利用者の確認後に行う',inputSchema:{type:'object',properties:{seat:{type:'integer',minimum:1,maximum:24}},required:['seat'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!queue.includes(input.seat))throw Error('提供待ちの席ではありません');askComplete(input.seat);return {confirmationOpened:true}}}];
 for(const tool of definitions){try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{})}catch{}}
}

function renderTally(){
 document.querySelector('#tally-value').textContent=tally;
 document.querySelector('#tally-up').setAttribute('aria-label','カウンター '+tally+'。タップで1増やす');
 document.querySelector('#tally-down').disabled=tally===0;
 document.querySelector('#tally-reset').disabled=tally===0;
 document.querySelector('#tally-up').disabled=tally===Number.MAX_SAFE_INTEGER;
}
function changeTally(delta){
 const next=tally+delta;
 if(!Number.isSafeInteger(next)||next<0)return;
 tally=next;saveQueue();renderTally();
}
document.querySelector('#tally-up').addEventListener('click',()=>changeTally(1));
document.querySelector('#tally-down').addEventListener('click',()=>changeTally(-1));
document.querySelector('#tally-reset').addEventListener('click',()=>{tally=0;saveQueue();renderTally()});
renderTally();

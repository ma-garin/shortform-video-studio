// 共通：データ・タイムライン・描画ヘルパ
const W=1080,H=1920;
const FONT="'Noto Sans CJK JP','Noto Sans JP',sans-serif";
let EX=[
 {scene:'切り出す',x:'最近どう？',o:'今週、一番気になったことは？',tag:'テーマを渡す',
  xr:'特に…普通です。',or:['一番気になったのはA社の仕様変更です。','木曜に急に来て、テストの前提が崩れました。','正直、優先順位を誰に確認すべきか迷っています。','一度、今日の後半で整理してもいいですか。'],
  xt:['最近','どう','？'],ot:['今週','、','一番','気になったこと','は','？']},
 {scene:'状態を聞く',x:'大丈夫？',o:'しんどいことと楽しいこと、一つずつ教えて',tag:'一つに絞る',
  xr:'大丈夫です。',or:['しんどいのは、レビュー待ちが3日続いていることです。','楽しいのは、自動化が初めて夜間で回ったこと。','待ちの間に何をすべきか、決めきれていません。'],
  xt:['大丈夫','？'],ot:['しんどいこと','と','楽しいこと','、','一つずつ','教えて']},
 {scene:'仕事を聞く',x:'進んでる？',o:'今週、一番時間を使ったのは？',tag:'実態を聞く',
  xr:'順調です。',or:['一番使ったのは、環境の再構築で丸2日です。','本来やるはずのテスト設計は半日しか取れていません。','来週も同じ環境問題が出そうです。'],
  xt:['進んでる','？'],ot:['今週','、','一番','時間を使った','のは','？']},
 {scene:'気持ちに触れる',x:'悩みはない？',o:'最近、もやもやしていることはある？',tag:'言葉を軽くする',
  xr:'ないです。',or:['もやもやしているのは、役割の線引きです。','私が拾うべき範囲が毎回変わる気がして。','言うほどではないかと思って黙っていました。','一度ルールにしてもらえると助かります。'],
  xt:['悩み','は','ない','？'],ot:['最近','、','もやもやしていること','は','ある','？']},
 {scene:'承認する',x:'よくできてるよ',o:'あの場面、どうやって対処したの？',tag:'過程を聞く',
  xr:'ありがとうございます。',or:['まず影響範囲を一覧にして、止める判断を先に出しました。','そのうえで顧客には結論から伝えて、代替案を2つ添えました。','正直、順番を迷ったので判断基準を確認したいです。','次は自分だけで最初の連絡まで持っていきたいです。'],
  xt:['よくできてる','よ'],ot:['あの場面','、','どうやって','対処した','の','？']},
 {scene:'次をつくる',x:null,o:'来週、一つだけ変えるなら？',tag:'一つだけ',
  xr:null,or:['レビュー依頼を、朝10時までに出すようにします。','木曜に進捗を私から共有します。'],
  xt:[],ot:['来週','、','一つだけ','変えるなら','？']}];
let PRINC=['テーマを渡す','一つに絞る','過程を聞く'];
let TITLE='1on1の質問 言い換え6選',SUB='「大丈夫です」で終わらせない';
const CREDIT='VOICEVOX:ずんだもん';

// 外部データ注入（Webシステムから）
if(window.__DATA__){const d=window.__DATA__;EX=d.items;PRINC=d.principles;TITLE=d.title;SUB=d.subtitle;}
const NS=EX.length;
function defaultTL(){const durs=[6.5,...EX.map(()=>7.5),12];const starts=[0];durs.slice(0,-1).forEach(x=>starts.push(starts[starts.length-1]+x));return{starts,durs,total:durs.reduce((a,b)=>a+b,0)}}
let TL=window.__TL__||defaultTL();
function setTL(t){TL=t}
const lerp=(a,b,t)=>a+(b-a)*t,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const eo=t=>{t=clamp(t);return 1-Math.pow(1-t,3)},ei=t=>{t=clamp(t);return t*t*t},eio=t=>{t=clamp(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2};
const back=t=>{t=clamp(t);const c=1.70158;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
function sceneAt(t){for(let i=TL.starts.length-1;i>=0;i--)if(t>=TL.starts[i])return i;return 0}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function wrap(c,text,maxW){const NG='、。？！」）ー…';const out=[];let line='';for(const ch of text){if(c.measureText(line+ch).width>maxW&&line&&!NG.includes(ch)){out.push(line);line=ch}else line+=ch}if(line)out.push(line);return out}
function font(c,w,px){c.font=`${w} ${px}px ${FONT}`}
// フォント読み込み待ち
async function ready(){if(document.fonts){await document.fonts.load(`700 40px ${FONT}`);await document.fonts.load(`400 40px ${FONT}`)}}

// 文字ごとに立ち上がるタイトル（中央揃え、測定幅ベース）
function charsIn(c,text,cx,y,px,lt,t0,step=.03,dur=.4,color='#fff'){font(c,900,px);const ws=[...text].map(ch=>c.measureText(ch).width);const tot=ws.reduce((a,b)=>a+b,0);let x=cx-tot/2;c.save();c.textAlign='left';c.textBaseline='middle';c.fillStyle=color;
  [...text].forEach((ch,k)=>{const d=eo((lt-t0-k*step)/dur);c.globalAlpha=d;c.fillText(ch,x,y+(1-d)*40);x+=ws[k]});c.restore()}

const TOPICS = [
  {id:'topic1',no:'01',title:'성경 속 인물 연구소',desc:'성경 속 사람들의 말과 행동을 읽어보고 함께 추리해 봅니다.'},
  {id:'topic2',no:'02',title:'눈길이 머무는 단어',desc:'오늘 이상하게 마음에 머무는 단어를 찾아봅니다.'},
  {id:'topic3',no:'03',title:'요즘 청년으로 살아간다는 것',desc:'사람이 힘들잖아 지쳤다잖아'},
  {id:'topic4',no:'04',title:'이 세상의 가장 아름다운 젊음',desc:'그리스도의 빛으로 삶을 다시 바라봅니다.'}
];

const WORDS = [
  '기다림','두려움','광야','용서','멈춤','기쁨','길','선택','돌아봄','외로움',
  '빛','자비','용기','떠남','약속','감사','숨음','평화','십자가','만남',
  '분노','찾음','생명','회개','사랑','머무름','목마름','따름','슬픔','들음',
  '씨앗','화해','희망','놓아줌','빵','믿음','지침','일어남','포도나무','이웃'
];

const YOUTH_TOPICS = [
  '취업','비교','SNS','외로움','가족','돈','신앙','연애','공동체','소진',
  '성공','불확실한 미래','친구','인정','실패','기다림','경쟁','봉사','교회','관계'
];

const FINAL_QUESTIONS = [
  '오늘 나눔 가운데 오래 간직하고 싶은 것은 무엇인가요?',
  '오늘 다른 사람의 이야기 가운데 가장 기억나는 것은 무엇인가요?',
  '지금 하느님께서 나와 함께 계신다면 무엇을 함께하고 싶나요?',
  '오늘 나눔 가운데 감사하고 싶은 것은 무엇인가요?',
  '지금 나의 마음을 건네고 싶은 사람은 누구인가요?',
  '오늘의 나에게 필요한 한 단어를 남긴다면 무엇인가요?'
];

const params = new URLSearchParams(location.search);
const GROUP_ID = sanitizeGroupId(params.get('group') || '01');

let appState = {
  completed:{topic1:false,topic2:false,topic3:false,topic4:false},
  completedCount:0
};
let currentTopicId = null;
let selectedWords = [];
let selectedYouthTopic = '';
let selectedTheme = 'light';

const memberId = getOrCreateMemberId();
const storageKey = 'youth-sharing:' + GROUP_ID + ':' + memberId;

document.addEventListener('DOMContentLoaded', init);

function init(){
  byId('groupBadge').textContent = GROUP_ID + ' 그룹';
  renderHome();

  byId('topicBack').onclick = goHome;
  byId('finalBack').onclick = goHome;
  byId('finalButton').onclick = openFinal;
  byId('cancelComplete').onclick = closeConfirmModal;
  byId('confirmComplete').onclick = completeCurrentTopic;
  byId('makeCardButton').onclick = createShareCard;
  byId('downloadButton').onclick = downloadShareCard;

  document.querySelectorAll('.theme-button').forEach(btn=>{
    btn.onclick = ()=>{
      document.querySelectorAll('.theme-button').forEach(x=>x.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTheme = btn.dataset.theme;
      saveFinalDraft();
    };
  });

  ['final1','final2','final3','final4'].forEach(id=>{
    byId(id).addEventListener('input', saveFinalDraft);
  });

  restoreFinalDraft();
  loadGroupState();
}

function apiJsonp(action, params={}){
  return new Promise((resolve,reject)=>{
    if(!API_URL || API_URL.includes('PASTE_YOUR')){
      reject(new Error('config.js에 Apps Script URL을 입력해 주세요.'));
      return;
    }

    const callbackName = '__jsonp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const url = new URL(API_URL);

    url.searchParams.set('action', action);
    url.searchParams.set('callback', callbackName);
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));

    const timer = setTimeout(()=>{
      cleanup();
      reject(new Error('API 응답 시간이 초과되었습니다.'));
    }, 12000);

    window[callbackName] = payload=>{
      cleanup();
      if(payload && payload.ok) resolve(payload.data);
      else reject(new Error(payload && payload.error ? payload.error : 'API 오류'));
    };

    function cleanup(){
      clearTimeout(timer);
      delete window[callbackName];
      if(script.parentNode) script.parentNode.removeChild(script);
    }

    script.onerror = ()=>{
      cleanup();
      reject(new Error('Apps Script API에 연결하지 못했습니다.'));
    };
    script.src = url.toString();
    document.body.appendChild(script);
  });
}

async function loadGroupState(){
  try{
    const result = await apiJsonp('state',{group:GROUP_ID});
    appState = result;
    hideConnection();
    renderHome();
  }catch(err){
    showConnection(err.message);
  }
}

async function completeCurrentTopic(){
  if(!currentTopicId) return;
  closeConfirmModal();

  try{
    const result = await apiJsonp('complete',{group:GROUP_ID,topic:currentTopicId});
    appState = result;
    renderHome();
    showView('homeView');
    toast('나눔을 완료했어요.');
    currentTopicId = null;
  }catch(err){
    showConnection(err.message);
    toast('완료 저장에 실패했어요.');
  }
}

function renderHome(){
  const list = byId('topicList');
  list.innerHTML='';

  TOPICS.forEach(topic=>{
    const done = !!appState.completed[topic.id];
    const btn = document.createElement('button');
    btn.className = 'topic-card' + (done?' done':'');
    btn.innerHTML = `
      <div class="topic-num">${topic.no}</div>
      <div>
        <h3 class="topic-title">${topic.title}</h3>
        <p class="topic-desc">${done?'완료한 나눔입니다.':topic.desc}</p>
      </div>
      <div class="topic-arrow">${done?'↻':'›'}</div>`;
    btn.onclick = ()=>openTopic(topic.id);
    list.appendChild(btn);
  });

  byId('progressText').textContent = `${appState.completedCount} / 4`;
  byId('progressFill').style.width = `${appState.completedCount/4*100}%`;

  byId('finalHint').textContent =
    appState.completedCount === 0
      ? '오늘의 마무리 질문입니다.'
      : appState.completedCount === 4
        ? '네 가지 나눔을 모두 마쳤어요. 이제 오늘을 정리해 보세요.'
        : '원하는 만큼 나누었다면, 이제 오늘을 정리해 보세요.';
}

function openTopic(id){
  currentTopicId=id;
  if(id==='topic1') renderTopic1();
  if(id==='topic2') renderTopic2();
  if(id==='topic3') renderTopic3();
  if(id==='topic4') renderTopic4();
  restoreTopicDraft(id);
  showView('topicView');
}

function goHome(){
  saveTopicDraft();
  currentTopicId=null;
  renderHome();
  showView('homeView');
}

function showView(id){
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  byId(id).classList.add('active');
  window.scrollTo(0,0);
}

function completionSection(){
  if(appState.completed[currentTopicId]){
    return `<div class="completed-box"><strong>✓ 우리 그룹이 이미 완료한 나눔입니다.</strong><span>질문과 개인 메모는 언제든 다시 볼 수 있어요.</span></div>`;
  }
  return `<button class="complete-button" id="completeTopicButton">이 나눔을 마쳤어요 ✓</button>
  <p class="privacy">완료하면 그룹 진행상태에 반영됩니다. 완료 후에도 다시 들어올 수 있어요.</p>`;
}

function bindTopicCommon(){
  document.querySelectorAll('#topicContent [data-note]').forEach(el=>el.addEventListener('input',saveTopicDraft));
  const b=byId('completeTopicButton');
  if(b) b.onclick=openConfirmModal;
}

function openConfirmModal(){saveTopicDraft();byId('confirmModal').classList.add('show')}
function closeConfirmModal(){byId('confirmModal').classList.remove('show')}

function renderTopic1(){
  byId('topicContent').innerHTML = `
    <h2 class="page-title">성경 속 인물 연구소</h2>
    <p class="page-lead">성격 유형의 정답을 맞히는 활동이 아니라, 성경 속 말과 행동을 근거로 한 사람을 자세히 바라봅니다.<br />그룹의 막내가 그룹 주제에 해당하는 인물에 대해 읽어보세요.</p>
    ${personPanel('창세기 그룹 - 야곱','cream','jacob',[
      ['창세 25,31','“먼저 형의 맏아들 권리를 내게 파시오.”'],
      ['창세 32,27','“저에게 축복해 주시지 않으면 놓아 드리지 않겠습니다.”'],
      ['창세 46,30','“네가 아직 살아 있는 것을 이렇게 내 눈으로 보았으니, 이제는 죽어도 여한이 없구나.”']
    ],[])}
    ${personPanel('탈출기 그룹 - 모세','sage','moses',[
      ['탈출 3,11','“제가 무엇이라고 감히 파라오에게 가서 이스라엘 자손들을 이집트에서 이끌어 낼 수 있겠습니까?”'],
      ['탈출 4,10','“저는 말솜씨가 없는 사람입니다.”'],
      ['탈출 32,32','“그러나 이제 그들의 죄를 부디 용서해 주시기 바랍니다.”']
    ],[])}
    ${personPanel('요한 그룹 - 베드로','sky','peter',[
      ['요한 6,68','“주님, 저희가 누구에게 가겠습니까? 주님께는 영원한 생명의 말씀이 있습니다.”'],
      ['요한 13,8-9','“제 발은 절대로 씻지 못하십니다.” / “주님, 제 발만 아니라 손과 머리도 씻어 주십시오.”'],
      ['요한 21,7','“주님이십니다.”']
    ],[])}
    <div class="panel">
      <h3>함께 나누기</h3>
      <ul class="questions">
        <li>인물의 성격 중에서 인상적인 부분은 무엇이며, 왜 그렇게 생각하나요?</li>
        <li>이 이야기의 끝에 하느님께서는 이 사람의 성격을 바꾸셨을까요, 아니면 이 사람의 모습을 그대로 사용하셨을까요?</li>
      </ul>
      <textarea class="note" data-note="general" placeholder="기억하고 싶은 생각을 적어 두어도 좋아요."></textarea>
    </div>
    ${completionSection()}`;
  bindTopicCommon();
}

function personPanel(name,color,key,verses,questions){
  return `<div class="panel ${color}">
    <h3>${name}</h3>
    ${verses.map(v=>`<div class="scripture"><b>${v[0]}</b><br>${v[1]}</div>`).join('')}
    <ul class="questions">${questions.map(q=>`<li>${q}</li>`).join('')}</ul>
    <textarea class="note" data-note="${key}" placeholder="메모"></textarea>
  </div>`;
}

function renderTopic2(){
  byId('topicContent').innerHTML = `
    <h2 class="page-title">눈길이 머무는 단어</h2>
    <p class="page-lead">오늘 특별히 눈길이 가거나 마음에 걸리는 단어 세 개를 골라 보세요.</p>
    <div class="panel rose"><div class="word-cloud">
      ${WORDS.map(w=>`<button class="chip" data-word="${w}">${w}</button>`).join('')}
    </div></div>
    <div class="panel">
      <h3>내가 고른 단어</h3>
      <div id="wordResult" class="quote">아직 선택하지 않았어요.</div>
      <ul class="questions">
        <li>왜 하필 이 세 단어가 오늘 내 눈에 들어왔을까요?</li>
        <li>지금의 나를 표현하는 단어가 있나요? 아니면 지금의 나에게 필요해서 눈에 들어온 단어가 있나요?</li>
        <li>그룹원들과 나누고 싶은 내용을 정리해 보세요.</li>
      </ul>
      <textarea class="note" data-note="general" placeholder="메모"></textarea>
    </div>
    ${completionSection()}`;
  document.querySelectorAll('[data-word]').forEach(btn=>btn.onclick=()=>toggleWord(btn));
  bindTopicCommon();
}

function toggleWord(btn){
  const w=btn.dataset.word;
  const i=selectedWords.indexOf(w);
  if(i>=0){selectedWords.splice(i,1);btn.classList.remove('selected')}
  else{
    if(selectedWords.length>=3){toast('세 단어까지 선택할 수 있어요.');return}
    selectedWords.push(w);btn.classList.add('selected');
  }
  updateWordResult();saveTopicDraft();
}
function updateWordResult(){
  const el=byId('wordResult');
  if(el) el.textContent=selectedWords.length?selectedWords.join(' · '):'아직 선택하지 않았어요.';
}

function renderTopic3(){
  byId('topicContent').innerHTML = `
    <h2 class="page-title">요즘 청년으로 살아간다는 것</h2>
    <p class="page-lead">요즘 가장 마음이 가거나 자주 생각하게 되는 주제를 하나 골라 봅니다.</p>
    <div class="panel sky"><div class="choice-grid">
      ${YOUTH_TOPICS.map(x=>`<button class="choice" data-youth="${x}">${x}</button>`).join('')}
    </div></div>
    <div class="panel">
      <h3 id="youthTopicTitle">하나를 골라 주세요.</h3>
      <ul class="questions">
        <li>왜 이 주제를 골랐는지, 이것은 세상의 이야기인지, 나의 이야기인지, 혹은 둘 다인지 생각해보고 나누어 봅시다.</li>
        <li>그룹원의 나눔에서 발견한 나의 새로운 생각을 적어봅시다.</li>
      </ul>
      <textarea class="note" data-note="general" placeholder="메모"></textarea>
    </div>
    ${completionSection()}`;
  document.querySelectorAll('[data-youth]').forEach(btn=>btn.onclick=()=>chooseYouthTopic(btn));
  bindTopicCommon();
}
function chooseYouthTopic(btn){
  document.querySelectorAll('[data-youth]').forEach(x=>x.classList.remove('selected'));
  btn.classList.add('selected');
  selectedYouthTopic=btn.dataset.youth;
  byId('youthTopicTitle').textContent=selectedYouthTopic;
  saveTopicDraft();
}

function renderTopic4(){
  byId('topicContent').innerHTML = `
    <h2 class="page-title">이 세상의 가장 아름다운 젊음</h2>
    <p class="page-lead">다음은 프란치스코 교황님께서 젊은이들에게 전하신 권고입니다. 다음 중 한 문단을 선택하여 그룹의 맏이가 읽습니다.</p>
    <div class="panel sky">
      <h3>프란치스코 교황 「그리스도는 살아 계십니다」</h3>
      <div class="quote">“그리스도께서는 살아 계십니다. 그분께서는 우리의 희망이시며 이 세상에 가장 아름다운 젊음을 가져다주시는 분이십니다.”</div>
      <div class="source">「그리스도는 살아 계십니다」 1항</div>
      <h4>함께 읽기</h4>
      <p class="scripture">7항<br />기드온에게서 우리는 현실을 미화시켜 받아들이는 데에 익숙지 않은 젊은이의 솔직함을 보게 됩니다.
       기드온은 주님께서 자신과 함께 계시다는 말을 듣고 다음과 같이 대답합니다. 
       "주님께서 저희와 함께 계시다면, 어째서 저희가 이 모든 일을 겪고 있단 말입니까?"(판관 6,13)
       하느님께서는 그의 못마땅한 대꾸에도 실망하지 않으시고 나아가 이렇게 명하십니다. "너의 그 힘을 지니고 가서 이스라엘을 구원하여라."(판관 6,14)</p>
      <p class="scripture">13항<br />영원한 젊음이신 예수님께서 우리에게 영원히 젊은 마음을 주고자 하십니다. 하느님 말씀은 우리에게 이렇게 촉구합니다. 
      "묵은 누룩을 깨끗이 치우고 새 반죽이 되십시오"(1코린 5, 7).
      바오로 성인은 우리에게 "옛 인간"을 벗어버리고 "새" 인간을 입으라고 권고합니다.(콜로 3,9-10 참조).
      "끊임없이 새로워지는"(콜로 3,10) 젊음을 입는다는 의미를 바오로 성인은 이렇게 풀이합니다. "동정과 호의와 겸손과 온유와 인내를 입으십시오. 누가 누구에게 불평할 일이 있더라도 서로 참아 주고
      서로 용서해 주십시오."(콜로 3,12-13) 참젊음은 바로 사랑할 수 있는 마음을 지닌다는 뜻입니다. 
      반대로, 우리를 서로 떼어 놓는 것들은 모두 우리의 영혼을 늙게 만듭니다. 바오로 성인은 마침내 이렇게 말합니다. 
      "이 모든 것 위에 사랑을 입으십시오. 사랑은 완전하게 묶어 주는 끈입니다."(콜로 3,14)</p>
      <p class="scripture">109항<br />여러분이 젊은데도 힘없고 지치고 실의에 빠진다면, 예수님께 새로운 힘을 청하십시오. 
      예수님과 함께라면, 희망은 결코 사라지지 않습니다. 
      여러분이 악행이나 나쁜 습관들, 이기심이나 불건전한 쾌락에 압도당하고 있다고 느낄 때에도 예수님께 여러분을 새로워지게 해 달라고 청할 수 있습니다. 
      생명이 충만하신 예수님께서는 여러분을 도와주시어, 여러분의 젊음이 가치를 지니기를 바라십니다. 
      그리하여 여러분은 자신만의 특별함과 고유함으로 세상에 여러분만이 가능한 기여를 할 수 있을 것입니다.</p>
    </div>
    <div class="panel">
      <h3>잠시 질문에 답하고 나누어 봅시다.</h3>
      <ul class="questions">
        <li>나에게 와닿은 문장이나 단어가 있나요?</li>
        <li>내가 생각하는 젊음이란 무엇인가요?</li>
        <li>나를 사랑하시는 하느님께서는 내가 어떤 모습이 되기를 바라실까요?</li>
      </ul>
      <textarea class="note" data-note="general" placeholder="마음에 남은 문장이나 생각"></textarea>
    </div>
    ${completionSection()}`;
  bindTopicCommon();
}

function getLocalData(){
  try{return JSON.parse(localStorage.getItem(storageKey)||'{"topics":{},"final":{}}')}
  catch{return {topics:{},final:{}}}
}
function setLocalData(x){localStorage.setItem(storageKey,JSON.stringify(x))}
function saveTopicDraft(){
  if(!currentTopicId)return;
  const data=getLocalData();data.topics=data.topics||{};
  const draft=data.topics[currentTopicId]||{};
  document.querySelectorAll('#topicContent [data-note]').forEach(el=>draft[el.dataset.note]=el.value);
  if(currentTopicId==='topic2')draft.selectedWords=[...selectedWords];
  if(currentTopicId==='topic3')draft.selectedYouthTopic=selectedYouthTopic;
  data.topics[currentTopicId]=draft;setLocalData(data);
}
function restoreTopicDraft(id){
  const data=getLocalData(),draft=(data.topics||{})[id]||{};
  document.querySelectorAll('#topicContent [data-note]').forEach(el=>el.value=draft[el.dataset.note]||'');
  if(id==='topic2'){
    selectedWords=Array.isArray(draft.selectedWords)?draft.selectedWords.slice(0,3):[];
    document.querySelectorAll('[data-word]').forEach(btn=>btn.classList.toggle('selected',selectedWords.includes(btn.dataset.word)));
    updateWordResult();
  }
  if(id==='topic3'){
    selectedYouthTopic=draft.selectedYouthTopic||'';
    document.querySelectorAll('[data-youth]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.youth===selectedYouthTopic));
    if(selectedYouthTopic)byId('youthTopicTitle').textContent=selectedYouthTopic;
  }
}

function openFinal(){
  byId('finalQuestion').textContent=getPersonalFinalQuestion();
  restoreFinalDraft();
  showView('finalView');
}
function getPersonalFinalQuestion(){
  return FINAL_QUESTIONS[Math.abs(simpleHash(memberId+'|'+GROUP_ID))%FINAL_QUESTIONS.length];
}
function saveFinalDraft(){
  const data=getLocalData();
  data.final={final1:byId('final1').value,final2:byId('final2').value,final3:byId('final3').value,final4:byId('final4').value,theme:selectedTheme};
  setLocalData(data);
}
function restoreFinalDraft(){
  const f=(getLocalData().final)||{};
  ['final1','final2','final3','final4'].forEach(id=>byId(id).value=f[id]||'');
  selectedTheme=f.theme||'light';
  document.querySelectorAll('.theme-button').forEach(btn=>btn.classList.toggle('selected',btn.dataset.theme===selectedTheme));
}

function createShareCard(){
  saveFinalDraft();
  const vals=['final1','final2','final3','final4'].map(id=>byId(id).value.trim());
  if(vals.every(v=>!v)){toast('카드에 담을 내용을 하나 이상 적어 보세요.');return}
  const canvas=byId('shareCanvas'),ctx=canvas.getContext('2d'),theme=getCanvasTheme(selectedTheme);
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle=theme.background;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle=theme.border;ctx.lineWidth=2;ctx.strokeRect(46,46,988,1258);
  ctx.textAlign='center';ctx.fillStyle='#9B7B58';ctx.font='900 22px sans-serif';ctx.fillText("TODAY'S SHARING",540,125);
  ctx.fillStyle='#294755';ctx.font='900 25px sans-serif';ctx.fillText('2026 하반기 청년성서모임',540,200);ctx.fillText('시작 나눔 돌아보기',540,260);
  let y=335;
  const sections=[['오늘 나의 나눔 주제',vals[0]||'—'],['마음에 남은 말',vals[1]||'—'],['하느님과 나누고 싶은 말',vals[2]||'—'],['이번 한 주 간직하고 싶은 마음',vals[3]||'—']];
  const total=vals.join('').length;let size=40;if(total>180)size=34;if(total>300)size=30;if(total>430)size=20;
  sections.forEach((sec,i)=>{
    ctx.fillStyle='#6F7F87';ctx.font='800 22px sans-serif';ctx.fillText(sec[0],540,y);y+=48;
    ctx.fillStyle='#263238';ctx.font=`700 ${size}px sans-serif`;
    wrapTextKorean(ctx,sec[1],820).forEach(line=>{ctx.fillText(line,540,y);y+=size*1.55});y+=i===3?12:30;
  });
  ctx.fillStyle='#6F7F87';ctx.font='500 15px sans-serif';ctx.fillText('2026 하반기 홍제동성당 청년 성서모임 OT',540,1260);
  byId('canvasWrap').classList.add('show');byId('canvasWrap').scrollIntoView({behavior:'smooth'});
}
function getCanvasTheme(t){
  if(t==='water')return{background:'#EEF5F7',border:'rgba(54,88,108,.20)'};
  if(t==='olive')return{background:'#F0F3EA',border:'rgba(54,88,108,.18)'};
  return{background:'#FBF7ED',border:'rgba(54,88,108,.18)'};
}
function wrapTextKorean(ctx,text,maxWidth){
  const out=[];
  String(text||'').split('\n').forEach(p=>{
    if(!p.trim()){out.push('');return}
    let line='';
    p.split(/\s+/).forEach(word=>{
      const test=line?line+' '+word:word;
      if(ctx.measureText(test).width<=maxWidth)line=test;
      else{if(line)out.push(line);line=word}
    });
    if(line)out.push(line);
  });
  return out;
}
function downloadShareCard(){
  byId('shareCanvas').toBlob(blob=>{
    if(!blob)return;
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`오늘의_나눔_${GROUP_ID}_${dateKey()}.png`;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  },'image/png');
}

function showConnection(msg){const el=byId('connectionMessage');el.textContent=msg;el.classList.add('show')}
function hideConnection(){byId('connectionMessage').classList.remove('show')}
function byId(id){return document.getElementById(id)}
function toast(msg){const el=byId('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}
function getOrCreateMemberId(){const k='youthBibleSharingMemberId';let id=localStorage.getItem(k);if(!id){id='m_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);localStorage.setItem(k,id)}return id}
function simpleHash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h|0}
function sanitizeGroupId(v){return String(v||'01').replace(/[^\w가-힣-]/g,'').slice(0,40)||'01'}
function dateKey(){const d=new Date();return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')}

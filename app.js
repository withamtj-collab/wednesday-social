firebase.initializeApp(firebaseConfig);
const db=firebase.database();
const FRONT_PAR=36,BACK_PAR=34,MAX_HANDICAP=15,TOURNEY_WEEKS=6;
const genId=()=>Math.random().toString(36).substr(2,9);
let S={golfers:[],weeks:[],settings:{startDate:'',endDate:'',adminPassword:'golf2026'},tournament:null,scrambleHistory:[],announcement:''};
let isAdmin=false,curPage='standings';
let skP=[],skC=5,jNine='front',jP=[],jC=5,jW={},jPd={};

// Firebase
function loadData(){db.ref('league').on('value',snap=>{const d=snap.val();if(d){S.golfers=d.golfers?Object.values(d.golfers):[];S.weeks=d.weeks?Object.values(d.weeks):[];S.settings=d.settings||{startDate:'',endDate:'',adminPassword:'golf2026'};S.tournament=d.tournament||null;S.scrambleHistory=d.scrambleHistory?Object.values(d.scrambleHistory):[];S.announcement=d.announcement||'';}document.getElementById('loading').style.display='none';document.getElementById('app').style.display='';renderNav();renderAnnouncement();renderPage();});}
function sv(p,d){db.ref('league/'+p).set(d);}
function svG(){sv('golfers',S.golfers.reduce((o,g,i)=>{o[i]=g;return o;},{}));}
function svW(){sv('weeks',S.weeks.reduce((o,w,i)=>{o[i]=w;return o;},{}));}
function svS(){sv('settings',S.settings);}
function svT(){sv('tournament',S.tournament);}
function svSH(){sv('scrambleHistory',S.scrambleHistory.reduce((o,s,i)=>{o[i]=s;return o;},{}));}

// Helpers
function wksBetween(s,e){if(!s||!e)return[];const ws=[];let d=new Date(s+'T12:00:00'),end=new Date(e+'T12:00:00'),i=1;while(d<=end){ws.push({wn:i,date:d.toISOString().split('T')[0],nine:'front',scores:{},noShows:{},matchups:[],isScramble:false,scrambleTeams:[],scrambleExcluded:[]});d.setDate(d.getDate()+7);i++;}return ws;}
function calcHcp(scores,weeks){if(!scores.length)return 0;let t=0,c=0;scores.forEach(({wn,score})=>{const w=weeks.find(x=>x.wn===wn);if(!w||!score)return;t+=Math.max(0,score-(w.nine==='front'?FRONT_PAR:BACK_PAR));c++;});return c?Math.min(MAX_HANDICAP,Math.round(t/c)):0;}
function gSc(gid,wks){return(wks||S.weeks).filter(w=>w.scores&&w.scores[gid]&&!(w.noShows&&w.noShows[gid])).map(w=>({wn:w.wn,score:w.scores[gid]}));}
// Handicap updates every 3 completed weeks: uses scores only from weeks up to the latest 3-week checkpoint
function completedWeeks(){return S.weeks.filter(w=>w.scores&&Object.keys(w.scores).length>0).length;}
function hcpCutoff(){const cw=completedWeeks();const checkpoint=Math.floor(cw/3)*3;return checkpoint;}
function gScHcp(gid){
  // Get completed weeks in order, take only up to the latest 3-week checkpoint
  const played=S.weeks.filter(w=>w.scores&&Object.keys(w.scores).length>0&&w.scores[gid]&&!(w.noShows&&w.noShows[gid]));
  const allPlayed=S.weeks.filter(w=>w.scores&&Object.keys(w.scores).length>0);
  const cp=Math.floor(allPlayed.length/3)*3;
  if(cp===0)return[];
  // Only use scores from the first cp completed weeks
  const cutoffWks=allPlayed.slice(0,cp);
  return cutoffWks.filter(w=>w.scores[gid]&&!(w.noShows&&w.noShows[gid])).map(w=>({wn:w.wn,score:w.scores[gid]}));
}
function eHcp(g,wks){
  // If wks is explicitly passed (for specific week subsets like tournament seeding), use all scores in that range
  if(wks&&wks!==S.weeks){const s=gSc(g.id,wks);return s.length===0&&g.priorHcp!=null?g.priorHcp:calcHcp(s,wks);}
  // Otherwise use 3-week checkpoint handicap
  const s=gScHcp(g.id);
  return s.length===0&&g.priorHcp!=null?g.priorHcp:calcHcp(s,S.weeks);
}
function getRec(gid,wks){let w=0,l=0,t=0;(wks||S.weeks).forEach(wk=>{if(wk.isScramble)return;(wk.matchups||[]).forEach(m=>{// Skip shadow matches for the shadow opponent (g2)
if(m.isShadow&&m.g2===gid)return;if(m.g1!==gid&&m.g2!==gid)return;if(!m.result)return;if(m.result==='tie')t++;else if(m.result===gid)w++;else l++;});});return{w,l,t};}
function gN(id){return S.golfers.find(g=>g.id===id)?.name||'TBD';}
function regW(){return Math.max(0,S.weeks.length-TOURNEY_WEEKS);}
function fD(d){return new Date(d+'T12:00:00').toLocaleDateString();}
function avgRaw(g){const sc=gSc(g.id,S.weeks);if(!sc.length)return 99;return sc.reduce((a,s)=>a+s.score,0)/sc.length;}

// Auth
function toggleAuth(){if(isAdmin){isAdmin=false;curPage='standings';renderNav();renderAnnouncement();renderPage();uAB();}else document.getElementById('login-modal').style.display='';}
function closeLogin(){document.getElementById('login-modal').style.display='none';document.getElementById('pw-input').value='';}
function doLogin(){if(document.getElementById('pw-input').value===S.settings.adminPassword){isAdmin=true;closeLogin();renderNav();renderAnnouncement();renderPage();uAB();}else alert('Incorrect password');}
function uAB(){document.getElementById('auth-btn').innerHTML=isAdmin?'🔓 Logout':'🔐 Admin';}

// Nav
function renderNav(){const pages=isAdmin?['standings','results','scores','matchups','scramble','tournament','skins','johnnys','admin']:['standings','results','scores','matchups','scramble','tournament','skins','johnnys'];const lb={standings:'Standings',results:'📋 Results',scores:'Scores',matchups:'Matchups',scramble:'🏌️ Scramble',tournament:'Tournament',skins:'💰 Skins',johnnys:"🏆 Johnny's",admin:'🔧 Admin'};document.getElementById('nav').innerHTML=pages.map(p=>'<button class="nav-btn'+(curPage===p?' active':'')+'" onclick="goPage(\''+p+'\')">'+lb[p]+'</button>').join('');uAB();}
function goPage(p){curPage=p;document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));document.getElementById('page-'+p).classList.add('active');renderNav();renderPage();}
function renderPage(){const fn={standings:renderStandings,results:renderResults,scores:renderScores,matchups:renderMatchups,scramble:renderScramble,tournament:renderTournament,skins:renderSkins,johnnys:renderJohnnys,admin:()=>{if(isAdmin)renderAdmin();}};fn[curPage]();}

function svA(){sv('announcement',S.announcement);}
function renderAnnouncement(){
  const el=document.getElementById('announcement');
  if(isAdmin){
    const esc=S.announcement.replace(/"/g,'&quot;').replace(/</g,'&lt;');
    el.innerHTML='<div class="announce"><div class="announce-title">📢 League Announcements <span style="font-size:11px;font-weight:400;color:var(--dim)">(editing)</span></div><textarea class="announce-edit" id="announce-text" placeholder="Type an announcement for the league... (leave blank to hide)">'+S.announcement.replace(/</g,'&lt;')+'</textarea><div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-primary btn-sm" onclick="saveAnnounce()">Save</button><button class="btn btn-ghost btn-sm" onclick="clearAnnounce()">Clear</button></div></div>';
  } else if(S.announcement.trim()){
    const safe=S.announcement.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    el.innerHTML='<div class="announce"><div class="announce-title">📢 League Announcements</div><div class="announce-body">'+safe+'</div></div>';
  } else {
    el.innerHTML='';
  }
}
function saveAnnounce(){const t=document.getElementById('announce-text');if(t){S.announcement=t.value;svA();}}
function clearAnnounce(){S.announcement='';svA();}

// ─── STANDINGS ───────────────────────────────────────────────
function renderStandings(){
  const rw=regW();
  const data=S.golfers.map(g=>{const rec=getRec(g.id,S.weeks.slice(0,rw));const hcp=eHcp(g,S.weeks);const sc=gSc(g.id,S.weeks);const avg=sc.length?(sc.reduce((a,s)=>a+s.score,0)/sc.length).toFixed(1):'-';const tot=rec.w+rec.l+rec.t;const pct=tot>0?(rec.w+rec.t*.5)/tot:0;return{...g,rec,hcp,rounds:sc.length,avg,pct};}).sort((a,b)=>b.pct-a.pct||b.rec.w-a.rec.w);
  const low=data.filter(g=>g.rounds>0).sort((a,b)=>a.hcp-b.hcp)[0];
  const wp=S.weeks.filter(w=>w.scores&&Object.keys(w.scores).length>0).length;
  const cp=hcpCutoff();const nextUp=cp+3;
  let h='<div class="grid-auto" style="margin-bottom:20px"><div class="stat-box"><div class="stat-val">'+S.golfers.length+'</div><div class="stat-label">Golfers</div></div><div class="stat-box"><div class="stat-val">'+wp+'</div><div class="stat-label">Weeks Played</div></div><div class="stat-box"><div class="stat-val gold">'+(low?low.name+' ('+low.hcp+')':'-')+'</div><div class="stat-label">Low Handicap</div></div><div class="stat-box"><div class="stat-val">'+(cp>0?'Wk '+cp:'—')+'</div><div class="stat-label">HCP Based On</div></div></div>';
  if(wp>0)h+='<div style="font-size:12px;color:var(--dim);margin-bottom:8px">📊 Handicaps update every 3 weeks played (using scores through week '+cp+'). Next update after week '+nextUp+'.</div>';
  if(S.settings.startDate&&S.settings.endDate)h+='<div style="font-size:13px;color:var(--dim);margin-bottom:16px">Season: '+fD(S.settings.startDate)+' – '+fD(S.settings.endDate)+' | '+S.weeks.length+' weeks ('+rw+' regular + '+(S.weeks.length-rw)+' tournament)</div>';
  h+='<div class="card"><div class="card-title">📊 League Standings</div><div class="overflow-x"><table><thead><tr><th>#</th><th>Golfer</th><th>W</th><th>L</th><th>T</th><th>Win%</th><th>HCP</th><th>Rnds</th><th>Avg</th><th>Dues</th></tr></thead><tbody>';
  data.forEach((g,i)=>{h+='<tr'+(i<3?' class="row-highlight"':'')+'><td>'+(i+1)+'</td><td style="font-weight:600">'+g.name+'</td><td style="color:var(--accent)">'+g.rec.w+'</td><td style="color:var(--danger)">'+g.rec.l+'</td><td>'+g.rec.t+'</td><td>'+(g.pct*100).toFixed(1)+'%</td><td><span class="badge badge-gold">'+g.hcp+'</span></td><td>'+g.rounds+'</td><td>'+g.avg+'</td><td>'+(g.paidDues?'<span class="badge badge-accent">Paid</span>':'<span class="badge badge-danger">Unpaid</span>')+'</td></tr>';});
  h+='</tbody></table></div></div>';
  h+='<div class="card"><div class="card-title">🏆 Season Awards</div><div class="grid-auto-md"><div class="award"><div class="award-emoji">🥇</div><div class="award-label">Regular Season Champ</div><div class="award-name">'+(data[0]?.name||'TBD')+'</div>'+(data[0]?'<div class="award-sub">'+data[0].rec.w+'-'+data[0].rec.l+'-'+data[0].rec.t+'</div>':'')+'</div><div class="award"><div class="award-emoji">🎯</div><div class="award-label">Low Handicap</div><div class="award-name">'+(low?.name||'TBD')+'</div>'+(low?'<div class="award-sub">HCP: '+low.hcp+'</div>':'')+'</div><div class="award"><div class="award-emoji">🏆</div><div class="award-label">Tournament Champion</div><div class="award-name">'+(S.tournament?.champion||'TBD')+'</div></div></div></div>';
  document.getElementById('page-standings').innerHTML=h;
}

// ─── WEEKLY RESULTS ──────────────────────────────────────────
let resWk=1;
function renderResults(){
  if(!S.weeks.length){document.getElementById('page-results').innerHTML='<div class="card" style="text-align:center;padding:40px;color:var(--dim)">No weeks generated yet.</div>';return;}
  if(resWk>S.weeks.length)resWk=1;
  const wk=S.weeks.find(w=>w.wn===resWk);
  const par=wk?.nine==='front'?FRONT_PAR:BACK_PAR;
  const ns=wk?.noShows||{};
  let wo=S.weeks.map(w=>'<option value="'+w.wn+'"'+(w.wn===resWk?' selected':'')+'>Week '+w.wn+' – '+fD(w.date)+(w.isScramble?' (Scramble)':'')+'</option>').join('');

  let h='<div class="card"><div class="card-title">📋 Weekly Results Summary</div>';
  h+='<div class="flex-between" style="margin-bottom:20px"><select onchange="resWk=+this.value;renderResults()" style="width:auto">'+wo+'</select>';
  // Share button
  const ms=wk?.matchups||[];
  const hasResults=ms.some(m=>m.result);
  if(hasResults)h+='<button class="btn btn-ghost btn-sm" style="color:#25D366;border-color:#25D366" onclick="waResults('+resWk+')">📱 Share Results</button>';
  h+='</div>';
  h+='<div style="font-size:13px;color:var(--dim);margin-bottom:16px">'+(wk?.nine==='front'?'Front 9':'Back 9')+' | Par: '+par+(wk?.isScramble?' | Scramble Week':'')+'</div>';

  if(wk?.isScramble){
    // Scramble week: show teams if they exist
    const teams=wk.scrambleTeams||[];
    if(teams.length){
      h+='<div style="font-size:14px;font-weight:600;margin-bottom:12px">Scramble Teams</div><div class="grid-auto-lg">';
      teams.forEach((team,ti)=>{const th=team.reduce((a,p)=>a+p.hcp,0);
        h+='<div class="scramble-team"><div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--accent)">Team '+(ti+1)+' <span style="font-size:12px;color:var(--dim);font-weight:400">HCP: '+th+'</span></div>';
        team.forEach(p=>{const tc={A:'tier-a',B:'tier-b',C:'tier-c',D:'tier-d'}[p.tier]||'';
          h+='<div class="scramble-player"><div style="display:flex;align-items:center;gap:8px"><span class="scramble-tier '+tc+'">'+p.tier+'</span><span style="font-weight:600">'+p.name+'</span></div><span class="badge badge-gold">'+p.hcp+'</span></div>';});
        h+='</div>';});
      h+='</div>';
      h+='<div style="margin-top:12px"><button class="btn btn-ghost btn-sm" style="color:#25D366;border-color:#25D366" onclick="waScramble('+resWk+')">📱 Share Scramble Teams</button></div>';
    }else{h+='<div style="text-align:center;padding:20px;color:var(--dim)">No scramble teams generated for this week.</div>';}
  }else if(ms.length){
    // Regular week: matchup results
    ms.forEach((m,i)=>{
      const g1=S.golfers.find(g=>g.id===m.g1),g2=m.g2?S.golfers.find(g=>g.id===m.g2):null;
      const ns1=ns[m.g1],ns2=m.g2?ns[m.g2]:false;
      const s1=wk.scores?.[m.g1],s2=m.g2?wk.scores?.[m.g2]:null;
      const h1=g1?eHcp(g1,S.weeks):0,h2=g2?eHcp(g2,S.weeks):0;
      const n1=(!ns1&&s1)?s1-h1:null,n2=(!ns2&&s2)?s2-h2:null;
      const isWin1=m.result===m.g1,isWin2=m.result===m.g2,isTie=m.result==='tie';
      const rowClass=isTie?' tie-row':(isWin1||isWin2)?' win-row':'';
      const shadowTag=m.isShadow?'<span style="font-size:10px;color:#60a5fa;margin-left:6px">👤 Shadow</span>':'';

      h+='<div class="result-row'+rowClass+'">';
      h+='<div style="flex:1;display:flex;align-items:center;gap:8px">';
      h+='<span class="'+(isWin1?'result-win':isTie?'result-tie':'result-loss')+'">'+(g1?.name||'?')+'</span>';
      if(ns1)h+='<span class="badge badge-danger">NS</span>';
      else if(s1!=null)h+='<span style="font-size:12px;color:var(--dim)">'+s1+(n1!=null?' (net '+n1+')':'')+'</span>';
      h+='</div>';
      h+='<div style="font-size:12px;color:var(--dim);padding:0 12px">'+(m.result?isTie?'TIE':'':'vs')+'</div>';
      h+='<div style="flex:1;display:flex;align-items:center;gap:8px;justify-content:flex-end">';
      if(g2){
        if(ns2)h+='<span class="badge badge-danger">NS</span>';
        else if(s2!=null)h+='<span style="font-size:12px;color:var(--dim)">'+(n2!=null?'(net '+n2+') ':'')+s2+'</span>';
        h+='<span class="'+(isWin2?'result-win':isTie?'result-tie':'result-loss')+'">'+g2.name+'</span>';
      }else{h+='<span style="color:var(--dim)">BYE</span>';}
      h+=shadowTag+'</div></div>';
    });
  }else{h+='<div style="text-align:center;padding:30px;color:var(--dim)">No matchups or results for this week.</div>';}
  h+='</div>';
  document.getElementById('page-results').innerHTML=h;
}

// ─── SCORES ──────────────────────────────────────────────────
let scWk=1;
function renderScores(){
  if(!S.weeks.length){document.getElementById('page-scores').innerHTML='<div class="card" style="text-align:center;padding:40px;color:var(--dim)">No weeks generated yet.</div>';return;}
  if(scWk>S.weeks.length)scWk=1;const wk=S.weeks.find(w=>w.wn===scWk);const par=wk?.nine==='front'?FRONT_PAR:BACK_PAR;
  let wo=S.weeks.map(w=>'<option value="'+w.wn+'"'+(w.wn===scWk?' selected':'')+'>Week '+w.wn+' – '+fD(w.date)+(w.isScramble?' (Scramble)':'')+'</option>').join('');
  let ni=isAdmin?'<select onchange="setNine(this.value)" style="width:auto"><option value="front"'+(wk?.nine==='front'?' selected':'')+'>Front 9 (Par '+FRONT_PAR+')</option><option value="back"'+(wk?.nine==='back'?' selected':'')+'>Back 9 (Par '+BACK_PAR+')</option></select>':'';
  let st=wk?.isScramble?'<span class="badge badge-blue" style="margin-left:8px">Scramble Week</span>':'';
  let h='<div class="card"><div class="card-title">📝 Weekly Scores'+st+'</div><div class="flex-between" style="margin-bottom:20px"><div class="flex-wrap"><select onchange="scWk=+this.value;renderScores()" style="width:auto">'+wo+'</select>'+ni+'</div><div style="font-size:13px;color:var(--dim)">'+(wk?.nine==='front'?'Front 9':'Back 9')+' | Par: <strong style="color:var(--accent)">'+par+'</strong></div></div><div class="overflow-x"><table><thead><tr><th>Golfer</th>'+(isAdmin?'<th>No Show</th>':'')+'<th>Score</th><th>+/-</th><th>HCP</th><th>Net</th></tr></thead><tbody>';
  const ns=wk?.noShows||{};
  [...S.golfers].sort((a,b)=>a.name.localeCompare(b.name)).forEach(g=>{const isNS=ns[g.id];const sc=wk?.scores?.[g.id];const hcp=eHcp(g,S.weeks);const ov=(!isNS&&sc)?sc-par:null;const net=(!isNS&&sc)?sc-hcp:null;
    h+='<tr'+(isNS?' style="opacity:.5"':'')+'><td style="font-weight:600">'+g.name+(isNS&&!isAdmin?' <span class="badge badge-danger">NS</span>':'')+'</td>';
    if(isAdmin)h+='<td><label class="checkbox"><div class="checkbox-box'+(isNS?' checked':'')+'" onclick="togNoShow(\''+g.id+'\')"></div></label></td>';
    if(isNS){h+='<td style="color:var(--dim)">—</td><td style="color:var(--dim)">—</td><td><span class="badge badge-gold">'+hcp+'</span></td><td style="color:var(--dim)">—</td>';}
    else{h+=isAdmin?'<td><input type="number" class="input-sm" value="'+(sc||'')+'" onchange="setScore(\''+g.id+'\',this.value)"></td>':'<td>'+(sc||'-')+'</td>';
    h+='<td style="color:'+(ov>0?'var(--danger)':ov<0?'var(--accent)':'var(--text)')+'">'+( ov!=null?(ov>0?'+'+ov:ov):'-')+'</td><td><span class="badge badge-gold">'+hcp+'</span></td><td style="font-weight:700">'+(net!=null?net:'-')+'</td>';}
    h+='</tr>';});
  h+='</tbody></table></div></div>';document.getElementById('page-scores').innerHTML=h;
}
function setNine(v){const wk=S.weeks.find(w=>w.wn===scWk);if(wk){wk.nine=v;svW();}}
function setScore(gid,val){const wk=S.weeks.find(w=>w.wn===scWk);if(!wk)return;if(!wk.scores)wk.scores={};if(val===''||val===null)delete wk.scores[gid];else wk.scores[gid]=parseInt(val);svW();}
function togNoShow(gid){const wk=S.weeks.find(w=>w.wn===scWk);if(!wk)return;if(!wk.noShows)wk.noShows={};if(wk.noShows[gid]){delete wk.noShows[gid];}else{wk.noShows[gid]=true;delete wk.scores[gid];}svW();}

// ─── MATCHUPS ────────────────────────────────────────────────
let mWk=1;
function renderMatchups(){
  const rw=regW();const rws=S.weeks.slice(0,rw).filter(w=>!w.isScramble);
  if(!rws.length){document.getElementById('page-matchups').innerHTML='<div class="card" style="text-align:center;padding:40px;color:var(--dim)">No matchup weeks available.</div>';return;}
  if(!rws.find(w=>w.wn===mWk))mWk=rws[0]?.wn||1;const wk=S.weeks.find(w=>w.wn===mWk);
  let opts=rws.map(w=>'<option value="'+w.wn+'"'+(w.wn===mWk?' selected':'')+'>Week '+w.wn+' – '+fD(w.date)+'</option>').join('');
  let ab=isAdmin?'<div class="flex-wrap"><button class="btn btn-primary" onclick="genMatch()">🎲 Random Matchups</button><button class="btn btn-ghost" onclick="resolveMatch()">⚡ Resolve</button></div>':'';
  let h='<div class="card"><div class="card-title">⚔️ Weekly Matchups</div><div class="flex-between" style="margin-bottom:20px"><select onchange="mWk=+this.value;renderMatchups()" style="width:auto">'+opts+'</select>'+ab+'</div>';
  // Admin: player selector for matchup generation
  if(isAdmin&&!(wk?.matchups?.length)){
    const mExcl=wk?.matchupExcluded||[];
    h+='<div style="font-size:13px;font-weight:600;margin-bottom:8px">Select golfers playing this week:</div><div class="flex-wrap-sm" style="margin-bottom:16px">';
    S.golfers.forEach(g=>{h+='<button class="chip'+(!mExcl.includes(g.id)?' active':'')+'" onclick="togMatchPl(\''+g.id+'\')">'+g.name+'</button>';});
    h+='</div>';
  }
  const ms=wk?.matchups||[];
  // WhatsApp share buttons when matchups exist
  if(ms.length){
    const hasResults=ms.some(m=>m.result);
    h+='<div class="flex-wrap" style="margin-bottom:16px">';
    h+='<button class="btn btn-ghost btn-sm" style="color:#25D366;border-color:#25D366" onclick="waMatchups('+mWk+')">📱 Share Matchups</button>';
    if(hasResults)h+='<button class="btn btn-ghost btn-sm" style="color:#25D366;border-color:#25D366" onclick="waResults('+mWk+')">📱 Share Results</button>';
    h+='</div>';
  }
  if(ms.length){h+='<div class="grid-auto-lg">';
    const ns=wk?.noShows||{};
    ms.forEach((m,i)=>{const g1=S.golfers.find(g=>g.id===m.g1),g2=m.g2?S.golfers.find(g=>g.id===m.g2):null;const ns1=ns[m.g1],ns2=m.g2?ns[m.g2]:false;const s1=wk.scores?.[m.g1],s2=m.g2?wk.scores?.[m.g2]:null;const h1=g1?eHcp(g1,S.weeks):0,h2=g2?eHcp(g2,S.weeks):0;const n1=(!ns1&&s1)?s1-h1:null,n2=(!ns2&&s2)?s2-h2:null;
      const shadowTag=m.isShadow?'<div style="font-size:10px;color:#60a5fa;margin-bottom:4px">👤 Shadow Match — result counts for '+gN(m.g1)+' only</div>':'';
      h+='<div class="match-card"'+(m.isShadow?' style="border-color:rgba(96,165,250,.4);border-style:dashed"':'')+'><div class="match-label">Match '+(i+1)+'</div>'+shadowTag+'<div style="display:flex;justify-content:space-between;align-items:center"><div style="flex:1;text-align:center'+(ns1?';opacity:.5':'')+'"><div class="match-name'+(m.result===m.g1?' winner':'')+'">'+(g1?.name||'?')+'</div>'+(ns1?'<div class="match-detail" style="color:var(--danger)">No Show</div>':'<div class="match-detail">HCP:'+h1+(s1?' | '+s1:'')+'</div>'+(n1!=null?'<div class="match-net'+(m.result===m.g1?' winner':'')+'">'+n1+'</div>':''))+'</div><div class="match-vs">VS</div><div style="flex:1;text-align:center'+(ns2?';opacity:.5':'')+'">'+
      (g2?(ns2?'<div class="match-name'+(m.result===m.g2?' winner':'')+'">'+g2.name+'</div><div class="match-detail" style="color:var(--danger)">No Show</div>':'<div class="match-name'+(m.result===m.g2?' winner':'')+'">'+g2.name+'</div><div class="match-detail">HCP:'+h2+(s2?' | '+s2:'')+'</div>'+(n2!=null?'<div class="match-net'+(m.result===m.g2?' winner':'')+'">'+n2+'</div>':'')):'<div style="color:var(--dim)">BYE</div>')+'</div></div>'+(m.result?'<div style="text-align:center;margin-top:8px">'+(m.result==='tie'?'<span class="badge badge-silver">TIE</span>':'<span class="badge badge-accent">Winner: '+gN(m.result)+'</span>')+'</div>':'')+'</div>';});
    h+='</div>';}else{h+='<div style="text-align:center;padding:40px;color:var(--dim)">'+(isAdmin?'Select players above, then click 🎲 Random Matchups.':'No matchups yet.')+'</div>';}
  h+='</div>';document.getElementById('page-matchups').innerHTML=h;
}
function genMatch(){
  const wk=S.weeks.find(w=>w.wn===mWk);if(!wk)return;
  const excl=wk.matchupExcluded||[];
  const pl=S.golfers.filter(g=>!excl.includes(g.id));
  if(pl.length<2){alert('Need at least 2 players');return;}
  const isOdd=pl.length%2===1;
  // If odd, separate out the odd player and pair the rest evenly, then create shadow match
  const ids=[...pl].map(g=>g.id);
  // Collect all prior non-tournament matchup pairs this season
  const rw=regW();
  const priorPairs=new Set();
  S.weeks.forEach(w=>{if(w.wn===mWk||w.wn>rw||!w.matchups)return;(w.matchups||[]).forEach(m=>{if(m.g1&&m.g2&&!m.isShadow)priorPairs.add([m.g1,m.g2].sort().join(':'));});});
  const pairKey=(a,b)=>[a,b].sort().join(':');
  const isUsed=(a,b)=>priorPairs.has(pairKey(a,b));

  // Greedy matching with backtracking
  function buildMatchups(pool){
    if(pool.length<=1)return pool.length===1?{ms:[],leftover:pool[0]}:{ms:[],leftover:null};
    if(pool.length===0)return{ms:[],leftover:null};
    const first=pool[0];
    const rest=pool.slice(1);
    const candidates=[...rest].sort(()=>Math.random()-.5);
    for(const partner of candidates){
      if(!isUsed(first,partner)){
        const remaining=rest.filter(id=>id!==partner);
        const sub=buildMatchups(remaining);
        if(sub!==null)return{ms:[{g1:first,g2:partner,result:null},...sub.ms],leftover:sub.leftover};
      }
    }
    // Fallback: allow repeats if necessary
    for(const partner of candidates){
      const remaining=rest.filter(id=>id!==partner);
      const sub=buildMatchups(remaining);
      if(sub!==null)return{ms:[{g1:first,g2:partner,result:null},...sub.ms],leftover:sub.leftover};
    }
    return null;
  }

  let best=null,bestRepeats=Infinity;
  for(let att=0;att<50;att++){
    const shuffled=[...ids].sort(()=>Math.random()-.5);
    const result=buildMatchups(shuffled);
    if(result){
      const repeats=result.ms.filter(m=>m.g2&&isUsed(m.g1,m.g2)).length;
      if(repeats<bestRepeats){bestRepeats=repeats;best=result;}
      if(repeats===0)break;
    }
  }
  if(best){
    wk.matchups=best.ms;
    // If odd player left over, create a shadow match against a random already-paired player
    if(best.leftover){
      const paired=best.ms.filter(m=>m.g2).flatMap(m=>[m.g1,m.g2]);
      const shadow=paired[Math.floor(Math.random()*paired.length)];
      wk.matchups.push({g1:best.leftover,g2:shadow,result:null,isShadow:true});
    }
    if(bestRepeats>0)alert('Note: '+bestRepeats+' repeat matchup'+(bestRepeats>1?'s were':' was')+' unavoidable this week.');
  }else{alert('Could not generate matchups.');}
  svW();
}
function togMatchPl(gid){const wk=S.weeks.find(w=>w.wn===mWk);if(!wk)return;if(!wk.matchupExcluded)wk.matchupExcluded=[];const i=wk.matchupExcluded.indexOf(gid);if(i>=0)wk.matchupExcluded.splice(i,1);else wk.matchupExcluded.push(gid);svW();}
function resolveMatch(){const wk=S.weeks.find(w=>w.wn===mWk);if(!wk)return;const ns=wk.noShows||{};wk.matchups=(wk.matchups||[]).map(m=>{if(!m.g2)return{...m,result:m.g1};const ns1=ns[m.g1],ns2=ns[m.g2];if(ns1&&ns2)return{...m,result:'tie'};if(ns1)return{...m,result:m.g2};if(ns2)return{...m,result:m.g1};const s1=wk.scores?.[m.g1],s2=wk.scores?.[m.g2];if(!s1||!s2)return m;const g1=S.golfers.find(g=>g.id===m.g1),g2=S.golfers.find(g=>g.id===m.g2);const n1=s1-eHcp(g1,S.weeks),n2=s2-eHcp(g2,S.weeks);return{...m,result:n1<n2?m.g1:n2<n1?m.g2:'tie'};});svW();}

// ─── SCRAMBLE ────────────────────────────────────────────────
function renderScramble(){
  const sw=S.weeks.filter(w=>w.isScramble);let h='';
  if(isAdmin){h+='<div class="card"><div class="card-title">⚙️ Scramble Settings</div><div style="font-size:13px;color:var(--dim);margin-bottom:12px">Toggle weeks as scramble weeks. No matchups during scrambles.</div><div class="flex-wrap" style="margin-bottom:16px">';S.weeks.forEach(w=>{h+='<button class="chip'+(w.isScramble?' active':'')+'" onclick="togScWk('+w.wn+')">Wk '+w.wn+' – '+fD(w.date)+'</button>';});h+='</div></div>';}
  if(!sw.length){h+='<div class="card" style="text-align:center;padding:40px;color:var(--dim)">'+(isAdmin?'Toggle weeks above to create scramble weeks.':'No scramble weeks scheduled yet.')+'</div>';}
  sw.forEach(s=>{
    h+='<div class="card"><div class="card-title">🏌️ Scramble — Week '+s.wn+' ('+fD(s.date)+')</div>';
    if(isAdmin){h+='<div style="font-size:13px;font-weight:600;margin-bottom:8px">Select participating golfers:</div><div class="flex-wrap-sm" style="margin-bottom:16px">';
      S.golfers.forEach(g=>{const ex=s.scrambleExcluded||[];h+='<button class="chip'+(!ex.includes(g.id)?' active':'')+'" onclick="togScPl('+s.wn+',\''+g.id+'\')">'+g.name+'</button>';});
      h+='</div><button class="btn btn-primary" onclick="genScTeams('+s.wn+')" style="margin-bottom:16px">🎲 Generate Balanced Teams</button>';}
    const teams=s.scrambleTeams||[];
    if(teams.length){const hcps=teams.map(t=>t.reduce((a,p)=>a+p.hcp,0));
      h+='<div style="font-size:14px;font-weight:600;margin-bottom:8px">'+teams.length+' Teams</div><div style="font-size:12px;color:var(--dim);margin-bottom:12px">Team HCP range: '+Math.min(...hcps)+' – '+Math.max(...hcps)+' (spread: '+(Math.max(...hcps)-Math.min(...hcps))+')</div><div class="grid-auto-lg">';
      teams.forEach((team,ti)=>{const th=team.reduce((a,p)=>a+p.hcp,0);
        h+='<div class="scramble-team"><div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--accent)">Team '+(ti+1)+' <span style="font-size:12px;color:var(--dim);font-weight:400">HCP: '+th+'</span></div>';
        team.forEach(p=>{const tc={A:'tier-a',B:'tier-b',C:'tier-c',D:'tier-d'}[p.tier]||'';
          h+='<div class="scramble-player"><div style="display:flex;align-items:center;gap:8px"><span class="scramble-tier '+tc+'">'+p.tier+'</span><span style="font-weight:600">'+p.name+'</span></div><span class="badge badge-gold">'+p.hcp+'</span></div>';});
        h+='</div>';});h+='</div>';
      h+='<div style="margin-top:12px"><button class="btn btn-ghost btn-sm" style="color:#25D366;border-color:#25D366" onclick="waScramble('+s.wn+')">📱 Share Teams</button></div>';
    }else if(!isAdmin){h+='<div style="text-align:center;padding:20px;color:var(--dim)">Teams not yet generated.</div>';}
    h+='</div>';});
  document.getElementById('page-scramble').innerHTML=h;
}
function togScWk(wn){const wk=S.weeks.find(w=>w.wn===wn);if(wk){wk.isScramble=!wk.isScramble;if(!wk.isScramble){wk.scrambleTeams=[];wk.scrambleExcluded=[];}svW();}}
function togScPl(wn,gid){const wk=S.weeks.find(w=>w.wn===wn);if(!wk)return;if(!wk.scrambleExcluded)wk.scrambleExcluded=[];const i=wk.scrambleExcluded.indexOf(gid);if(i>=0)wk.scrambleExcluded.splice(i,1);else wk.scrambleExcluded.push(gid);svW();}
function genScTeams(wn){
  const wk=S.weeks.find(w=>w.wn===wn);if(!wk)return;const ex=wk.scrambleExcluded||[];
  const pl=S.golfers.filter(g=>!ex.includes(g.id)).map(g=>({id:g.id,name:g.name,hcp:eHcp(g,S.weeks),avg:avgRaw(g)}));
  if(pl.length<4){alert('Need at least 4 players');return;}
  pl.sort((a,b)=>a.hcp!==b.hcp?a.hcp-b.hcp:a.avg-b.avg);
  const nt=Math.floor(pl.length/4),ext=pl.length%4;
  const ti={A:[],B:[],C:[],D:[]};
  pl.forEach((p,i)=>{if(i<nt)ti.A.push({...p,tier:'A'});else if(i<nt*2)ti.B.push({...p,tier:'B'});else if(i<nt*3)ti.C.push({...p,tier:'C'});else ti.D.push({...p,tier:'D'});});
  ti.D.sort((a,b)=>a.hcp===MAX_HANDICAP&&b.hcp===MAX_HANDICAP?a.avg-b.avg:a.hcp-b.hcp);
  let best=null,bestSc=Infinity;const hist=S.scrambleHistory||[];
  for(let att=0;att<200;att++){
    const a=[...ti.A].sort(()=>Math.random()-.5),b=[...ti.B].sort(()=>Math.random()-.5),c=[...ti.C].sort(()=>Math.random()-.5),d=[...ti.D].sort(()=>Math.random()-.5);
    const teams=[];for(let t=0;t<nt;t++)teams.push([a[t],b[t],c[t],d[t]]);
    for(let e=0;e<ext;e++){const ep=d[nt+e]||c[nt+e];if(ep){const th=teams.map((t,i)=>({i,h:t.reduce((a,p)=>a+p.hcp,0)})).sort((a,b)=>a.h-b.h);teams[th[e%nt].i].push(ep);}}
    const hcps=teams.map(t=>t.reduce((a,p)=>a+p.hcp,0)),spread=Math.max(...hcps)-Math.min(...hcps);
    let dupe=false;const tkeys=teams.map(t=>t.map(p=>p.id).sort().join(','));
    for(const hi of hist){if(hi.teams){const hk=(Array.isArray(hi.teams)?hi.teams:[]).map(t=>(Array.isArray(t)?t:[]).map(p=>p.id).sort().join(','));for(const tk of tkeys){if(hk.includes(tk)){dupe=true;break;}}}if(dupe)break;}
    const sc=spread+(dupe?50:0);if(sc<bestSc){bestSc=sc;best=teams;}if(spread<=2&&!dupe)break;
  }
  if(best){wk.scrambleTeams=best;S.scrambleHistory.push({wn,teams:best.map(t=>t.map(p=>({id:p.id})))});svW();svSH();}
}

// ─── TOURNAMENT ──────────────────────────────────────────────
function renderTournament(){
  const rw=regW();const seeded=S.golfers.map(g=>{const r=getRec(g.id,S.weeks.slice(0,rw));const tot=r.w+r.l+r.t;const pct=tot>0?(r.w+r.t*.5)/tot:0;return{...g,rec:r,pct};}).sort((a,b)=>b.pct-a.pct||b.rec.w-a.rec.w).map((g,i)=>({...g,seed:i+1}));
  const t=S.tournament;let h='<div class="card"><div class="card-title">🏆 End of Season Tournament</div>';
  if(!t){h+='<div style="text-align:center;padding:40px"><div style="font-size:48px;margin-bottom:16px">🏆</div><div style="font-size:18px;font-weight:700;margin-bottom:8px">Tournament Bracket</div><div style="color:var(--dim);margin-bottom:20px">Seeded by record. NCAA-style with play-in games.</div>'+(isAdmin&&seeded.length>=2?'<button class="btn btn-primary" onclick="genBracket()">Generate Bracket</button>':'')+(isAdmin?'':'<div style="color:var(--dim)">Admin will generate bracket.</div>')+'</div>';}
  else{h+='<div style="overflow-x:auto"><div style="display:flex;gap:20px;min-width:'+t.totalRounds*240+'px;align-items:stretch">';
    for(let r=1;r<=t.totalRounds;r++){const rm=t.matches.filter(m=>m.round===r);const lbl=r===t.totalRounds?'Finals':r===t.totalRounds-1&&t.totalRounds>2?'Semis':'Round '+r;
      h+='<div style="flex:1;min-width:200px"><div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;text-align:center">'+lbl+'</div><div style="display:flex;flex-direction:column;gap:8px;justify-content:space-around;height:100%">';
      rm.forEach(m=>{const gs=id=>seeded.find(g=>g.id===id)?.seed||'?';
        if(m.isBye){h+='<div class="bracket-match bye"><div style="text-align:center;font-size:12px;color:var(--dim)"><strong>('+gs(m.winner)+') '+gN(m.winner)+'</strong> – BYE</div></div>';}
        else{const n1=m.g1?'('+gs(m.g1)+') '+gN(m.g1):'TBD',n2=m.g2?'('+gs(m.g2)+') '+gN(m.g2):'TBD';
          const p1=isAdmin&&m.g1&&m.g2?'<button class="bracket-pick'+(m.winner===m.g1?' won':'')+'" onclick="setTW(\''+m.id+"','"+m.g1+'\')">✅</button>':'';
          const p2=isAdmin&&m.g1&&m.g2?'<button class="bracket-pick'+(m.winner===m.g2?' won':'')+'" onclick="setTW(\''+m.id+"','"+m.g2+'\')">✅</button>':'';
          h+='<div class="bracket-match"><div class="bracket-row"><span style="font-weight:'+(m.winner===m.g1?700:400)+';color:'+(m.winner===m.g1?'var(--accent)':'var(--text)')+';font-size:13px">'+n1+'</span>'+p1+'</div><div class="bracket-divider"></div><div class="bracket-row"><span style="font-weight:'+(m.winner===m.g2?700:400)+';color:'+(m.winner===m.g2?'var(--accent)':'var(--text)')+';font-size:13px">'+n2+'</span>'+p2+'</div></div>';}});
      h+='</div></div>';}
    h+='</div></div>';
    if(t.champion)h+='<div class="champion-banner"><div style="font-size:36px">🏆</div><div style="font-size:22px;font-weight:800;color:var(--gold)">'+t.champion+'</div><div style="font-size:13px;color:var(--dim)">Tournament Champion</div></div>';
    h+='<div style="margin-top:16px"><button class="btn btn-ghost btn-sm" style="color:#25D366;border-color:#25D366;margin-right:8px" onclick="waTournament()">📱 Share Bracket</button>';
    if(isAdmin)h+='<button class="btn btn-danger" onclick="if(confirm(\'Reset bracket?\')){S.tournament=null;svT();}">Reset Bracket</button>';
    h+='</div>';}
  h+='</div><div class="card"><div class="card-title">🏅 Seedings</div><div class="overflow-x"><table><thead><tr><th>Seed</th><th>Golfer</th><th>Record</th><th>Win%</th></tr></thead><tbody>';
  seeded.forEach(g=>{h+='<tr><td style="font-weight:700;color:var(--accent)">#'+g.seed+'</td><td style="font-weight:600">'+g.name+'</td><td>'+g.rec.w+'-'+g.rec.l+'-'+g.rec.t+'</td><td>'+(g.pct*100).toFixed(1)+'%</td></tr>';});
  h+='</tbody></table></div></div>';document.getElementById('page-tournament').innerHTML=h;
}
function bOrd(sz){if(sz===2)return[0,1];const h=bOrd(sz/2);return h.reduce((a,s)=>{a.push(s);a.push(sz-1-s);return a;},[]);}
function genBracket(){const rw=regW();const sd=S.golfers.map(g=>{const r=getRec(g.id,S.weeks.slice(0,rw));const tot=r.w+r.l+r.t;const pct=tot>0?(r.w+r.t*.5)/tot:0;return{...g,rec:r,pct};}).sort((a,b)=>b.pct-a.pct||b.rec.w-a.rec.w).map((g,i)=>({...g,seed:i+1}));const n=sd.length;if(n<2)return;let bs=2;while(bs<n)bs*=2;const seeds=Array.from({length:bs},(_,i)=>i<n?sd[i]:null);const ord=bOrd(bs).map(p=>seeds[p]);const ms=[];for(let i=0;i<ord.length;i+=2){const a=ord[i],b=ord[i+1];const bye=!a||!b;ms.push({id:genId(),round:1,g1:a?.id||null,g2:b?.id||null,winner:bye?(a?.id||b?.id):null,isBye:bye});}const tr=Math.log2(bs);const all=[...ms];let prev=ms;for(let r=2;r<=tr;r++){const rm=[];for(let i=0;i<prev.length;i+=2){const m={id:genId(),round:r,g1:null,g2:null,winner:null,feedsFrom:[prev[i].id,prev[i+1]?.id]};if(prev[i].isBye)m.g1=prev[i].winner;if(prev[i+1]?.isBye)m.g2=prev[i+1].winner;rm.push(m);}all.push(...rm);prev=rm;}S.tournament={matches:all,totalRounds:tr,bracketSize:bs,champion:null};svT();}
function setTW(mid,wid){const t=S.tournament;if(!t)return;const match=t.matches.find(m=>m.id===mid);if(!match)return;match.winner=wid;const next=t.matches.find(m=>m.feedsFrom&&m.feedsFrom.includes(mid));if(next){const idx=next.feedsFrom.indexOf(mid);if(idx===0)next.g1=wid;else next.g2=wid;next.winner=null;}const fin=t.matches.find(m=>m.round===t.totalRounds);t.champion=fin?.winner?gN(fin.winner):null;svT();}

// ─── SKINS ───────────────────────────────────────────────────
function renderSkins(){
  const pot=skP.filter(p=>p.paid).length*skC;const ts=skP.reduce((a,p)=>a+(p.skins||0),0);const ps=ts>0?pot/ts:0;
  let h='<div class="card"><div class="card-title">💰 Skins Game Calculator</div><div style="margin-bottom:16px"><label style="font-size:13px;color:var(--dim);display:block;margin-bottom:4px">Cost Per Person ($)</label><input type="number" class="input-md" value="'+skC+'" onchange="skC=+this.value;renderSkins()"></div><div style="font-size:14px;font-weight:600;margin-bottom:8px">Select Players:</div><div class="flex-wrap-sm" style="margin-bottom:20px">';
  S.golfers.forEach(g=>{const isIn=skP.some(p=>p.id===g.id);h+='<button class="chip'+(isIn?' active':'')+'" onclick="togSkP(\''+g.id+'\')">'+g.name+'</button>';});h+='</div>';
  if(skP.length){h+='<div class="overflow-x"><table><thead><tr><th>Player</th><th>Paid</th><th>Skins</th><th>Payout</th></tr></thead><tbody>';
    skP.forEach(p=>{const g=S.golfers.find(g=>g.id===p.id);h+='<tr><td style="font-weight:600">'+(g?.name)+'</td><td><label class="checkbox"><div class="checkbox-box'+(p.paid?' checked':'')+'" onclick="togSkPd(\''+p.id+'\')"></div></label></td><td><input type="number" class="input-sm" min="0" value="'+(p.skins||'')+'" onchange="setSkCt(\''+p.id+'\',+this.value)"></td><td style="font-weight:700;color:var(--accent)">$'+(p.skins*ps).toFixed(2)+'</td></tr>';});
    h+='</tbody></table></div><div class="grid-auto" style="margin-top:16px"><div class="stat-box"><div class="stat-val gold">$'+pot.toFixed(2)+'</div><div class="stat-label">Total Pot</div></div><div class="stat-box"><div class="stat-val">'+ts+'</div><div class="stat-label">Total Skins</div></div><div class="stat-box"><div class="stat-val">$'+ps.toFixed(2)+'</div><div class="stat-label">Per Skin</div></div></div>';}
  h+='</div>';document.getElementById('page-skins').innerHTML=h;
}
function togSkP(id){const i=skP.findIndex(p=>p.id===id);if(i>=0)skP.splice(i,1);else skP.push({id,skins:0,paid:false});renderSkins();}
function togSkPd(id){const p=skP.find(p=>p.id===id);if(p)p.paid=!p.paid;renderSkins();}
function setSkCt(id,v){const p=skP.find(p=>p.id===id);if(p)p.skins=v;renderSkins();}

// ─── JOHNNY'S GAME ───────────────────────────────────────────
function renderJohnnys(){
  const cats=jNine==='front'?['Closest to Pin','Longest Putt','Longest Drive']:['Closest to Pin #10','Longest Putt','Closest to Pin #17'];
  const pc=Object.values(jPd).filter(Boolean).length;const pot=pc*jC;const perCat=cats.length>0?pot/cats.length:0;
  let h='<div class="card"><div class="card-title">🏆 Johnny\'s Game Calculator</div><div class="flex-between" style="margin-bottom:16px"><div class="flex-wrap"><button class="btn '+(jNine==='front'?'btn-primary':'btn-ghost')+'" onclick="jNine=\'front\';jW={};renderJohnnys()">Front 9</button><button class="btn '+(jNine==='back'?'btn-primary':'btn-ghost')+'" onclick="jNine=\'back\';jW={};renderJohnnys()">Back 9</button></div><div style="display:flex;align-items:center;gap:8px"><label style="font-size:13px;color:var(--dim)">$/Entry</label><input type="number" class="input-sm" value="'+jC+'" onchange="jC=+this.value;renderJohnnys()"></div></div><div style="font-size:14px;font-weight:600;margin-bottom:8px">Select Players:</div><div class="flex-wrap-sm" style="margin-bottom:12px">';
  S.golfers.forEach(g=>{const isIn=jP.includes(g.id);h+='<button class="chip'+(isIn?' active':'')+'" onclick="togJP(\''+g.id+'\')">'+g.name+'</button>';});h+='</div>';
  if(jP.length){h+='<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--dim)">Mark who paid:</div><div class="flex-wrap" style="margin-bottom:20px">';
    jP.forEach(id=>{const g=S.golfers.find(g=>g.id===id);h+='<label class="checkbox"><div class="checkbox-box'+(jPd[id]?' checked':'')+'" onclick="jPd[\''+id+'\']=!jPd[\''+id+'\'];renderJohnnys()"></div>'+(g?.name)+'</label>';});
    h+='</div><div class="grid-auto-md" style="margin-bottom:16px">';
    cats.forEach(cat=>{let opts='<option value="">Select winner...</option>';jP.forEach(id=>{const g=S.golfers.find(g=>g.id===id);opts+='<option value="'+id+'"'+(jW[cat]===id?' selected':'')+'>'+(g?.name)+'</option>';});
      h+='<div class="cat-card"><div class="cat-title">'+cat+'</div><select style="width:100%" onchange="jW[\''+cat+'\']=this.value;renderJohnnys()">'+opts+'</select>'+(jW[cat]?'<div class="cat-payout">Wins $'+perCat.toFixed(2)+'</div>':'')+'</div>';});
    h+='</div><div class="grid-auto"><div class="stat-box"><div class="stat-val gold">$'+pot.toFixed(2)+'</div><div class="stat-label">Total Pot</div></div><div class="stat-box"><div class="stat-val">'+pc+'/'+jP.length+'</div><div class="stat-label">Paid</div></div><div class="stat-box"><div class="stat-val">$'+perCat.toFixed(2)+'</div><div class="stat-label">Per Category</div></div></div>';
    if(Object.values(jW).some(Boolean)){h+='<div class="card" style="margin-top:16px"><div class="card-title">💵 Payouts</div>';cats.forEach(cat=>{if(!jW[cat])return;const g=S.golfers.find(g=>g.id===jW[cat]);h+='<div class="payout-row"><span>'+cat+'</span><span><strong style="color:var(--accent)">'+(g?.name)+'</strong> – <span style="color:var(--gold)">$'+perCat.toFixed(2)+'</span></span></div>';});h+='</div>';}}
  h+='</div>';document.getElementById('page-johnnys').innerHTML=h;
}
function togJP(id){const i=jP.indexOf(id);if(i>=0)jP.splice(i,1);else jP.push(id);renderJohnnys();}

// ─── ADMIN ───────────────────────────────────────────────────
function renderAdmin(){
  let h='<div class="card"><div class="card-title">⚙️ League Settings</div><div class="grid-2"><div><label style="font-size:13px;color:var(--dim);display:block;margin-bottom:4px">Season Start (Wednesday)</label><input type="date" value="'+S.settings.startDate+'" onchange="S.settings.startDate=this.value;svS()"></div><div><label style="font-size:13px;color:var(--dim);display:block;margin-bottom:4px">Season End (Wednesday)</label><input type="date" value="'+S.settings.endDate+'" onchange="S.settings.endDate=this.value;svS()"></div></div><div style="margin-top:12px" class="flex-wrap"><button class="btn btn-primary" onclick="aGenWk()">Generate Weekly Schedule</button>'+(S.weeks.length?'<span style="font-size:13px;color:var(--dim)">'+S.weeks.length+' weeks</span>':'')+'</div><div style="margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><label style="font-size:13px;color:var(--dim)">Admin Password:</label><input class="input-lg" value="'+S.settings.adminPassword+'" onchange="S.settings.adminPassword=this.value;svS()"></div></div>';
  h+='<div class="card"><div class="card-title">🏌️ Manage Golfers</div><div class="flex-wrap" style="margin-bottom:20px"><input id="nn" placeholder="Golfer name" style="flex:1;min-width:150px" onkeydown="if(event.key===\'Enter\')aAdd()"><input id="nh" type="number" placeholder="Prior HCP" style="width:120px" min="0" max="15"><button class="btn btn-primary" onclick="aAdd()">+ Add Golfer</button></div><div class="overflow-x"><table><thead><tr><th>Name</th><th>Prior HCP</th><th>Current HCP</th><th>Dues</th><th>Actions</th></tr></thead><tbody>';
  [...S.golfers].sort((a,b)=>a.name.localeCompare(b.name)).forEach(g=>{const hcp=eHcp(g,S.weeks);h+='<tr><td style="font-weight:600">'+g.name+'</td><td>'+(g.priorHcp!=null?g.priorHcp:'-')+'</td><td><span class="badge badge-gold">'+hcp+'</span></td><td><label class="checkbox"><div class="checkbox-box'+(g.paidDues?' checked':'')+'" onclick="aTD(\''+g.id+'\')"></div>'+(g.paidDues?'Paid':'Unpaid')+'</label></td><td><div class="flex-wrap"><button class="btn btn-ghost btn-sm" onclick="aEdit(\''+g.id+'\')">Edit</button><button class="btn btn-danger btn-sm" onclick="aRm(\''+g.id+'\')">✕</button></div></td></tr>';});
  h+='</tbody></table></div><div style="margin-top:12px;font-size:13px;color:var(--dim)">'+S.golfers.length+' golfer'+(S.golfers.length!==1?'s':'')+' registered</div></div>';
  h+='<div class="card danger-zone"><div class="card-title">⚠️ Danger Zone</div><button class="btn btn-danger" onclick="aReset()">Reset All League Data</button><div style="font-size:12px;color:var(--dim);margin-top:8px">Permanently deletes everything.</div></div>';
  document.getElementById('page-admin').innerHTML=h;
}
function aGenWk(){
  if(!S.settings.startDate||!S.settings.endDate)return alert('Set dates first');
  const nw=wksBetween(S.settings.startDate,S.settings.endDate);
  // Always update dates from the new schedule; preserve data on existing weeks
  S.weeks=nw.map(w=>{
    const ex=S.weeks.find(e=>e.wn===w.wn);
    if(ex){ex.date=w.date;return ex;}
    return w;
  });
  // Trim any extra weeks beyond new schedule length
  if(S.weeks.length>nw.length)S.weeks=S.weeks.slice(0,nw.length);
  svW();
  alert('Schedule generated: '+S.weeks.length+' weeks starting '+fD(S.settings.startDate));
}
function aAdd(){const n=document.getElementById('nn').value.trim(),hv=document.getElementById('nh').value;if(!n)return;S.golfers.push({id:genId(),name:n,paidDues:false,priorHcp:hv!==''?Math.min(MAX_HANDICAP,Math.max(0,parseInt(hv)||0)):null});svG();document.getElementById('nn').value='';document.getElementById('nh').value='';}
function aRm(id){if(confirm('Remove this golfer?')){S.golfers=S.golfers.filter(g=>g.id!==id);svG();}}
function aTD(id){const g=S.golfers.find(g=>g.id===id);if(g){g.paidDues=!g.paidDues;svG();}}
function aEdit(id){const g=S.golfers.find(g=>g.id===id);if(!g)return;const n=prompt('Golfer name:',g.name);if(n===null)return;const h=prompt('Prior handicap (blank=none):',g.priorHcp!=null?g.priorHcp:'');if(h===null)return;g.name=n.trim()||g.name;g.priorHcp=h!==''?Math.min(MAX_HANDICAP,Math.max(0,parseInt(h)||0)):null;svG();}
function aReset(){if(!confirm('Reset ALL league data?'))return;if(!confirm('Are you absolutely sure?'))return;db.ref('league').set(null);S={golfers:[],weeks:[],settings:{startDate:'',endDate:'',adminPassword:'golf2026'},tournament:null,scrambleHistory:[],announcement:''};}

// ─── WHATSAPP SHARE ──────────────────────────────────────────
function siteUrl(){return window.location.href.split('?')[0].split('#')[0];}
function waShare(msg){
  const encoded=encodeURIComponent(msg);
  // Try whatsapp:// deep link first (works on mobile), fall back to web
  const isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if(isMobile){window.location.href='whatsapp://send?text='+encoded;}
  else{window.open('https://web.whatsapp.com/send?text='+encoded,'_blank');}
}

// Share: Weekly matchups set
function waMatchups(wn){
  const wk=S.weeks.find(w=>w.wn===wn);if(!wk||!wk.matchups?.length)return;
  let msg='⛳ *The Wednesday Social*\n📅 Week '+wn+' — '+fD(wk.date)+'\n'+(wk.nine==='front'?'Front 9':'Back 9')+'\n\n⚔️ *This Week\'s Matchups:*\n';
  wk.matchups.forEach((m,i)=>{
    const n1=gN(m.g1),n2=m.g2?gN(m.g2):'BYE';
    const h1=S.golfers.find(g=>g.id===m.g1),h2=m.g2?S.golfers.find(g=>g.id===m.g2):null;
    const hcp1=h1?eHcp(h1,S.weeks):0,hcp2=h2?eHcp(h2,S.weeks):0;
    msg+=(i+1)+'. '+n1+' ('+hcp1+') vs '+n2+(h2?' ('+hcp2+')':'')+(m.isShadow?' 👤':'')+ '\n';
  });
  if(wk.matchups.some(m=>m.isShadow))msg+='\n👤 = Shadow match (counts for odd player only)\n';
  msg+='\n🔗 '+siteUrl();
  waShare(msg);
}

// Share: Week results recap
function waResults(wn){
  const wk=S.weeks.find(w=>w.wn===wn);if(!wk)return;
  const par=wk.nine==='front'?FRONT_PAR:BACK_PAR;
  const ns=wk.noShows||{};
  let msg='⛳ *The Wednesday Social*\n📅 Week '+wn+' Results — '+fD(wk.date)+'\n'+(wk.nine==='front'?'Front 9':'Back 9')+' (Par '+par+')\n\n';

  // Match results
  if(wk.matchups?.length){
    msg+='⚔️ *Match Results:*\n';
    wk.matchups.forEach((m,i)=>{
      const n1=gN(m.g1),n2=m.g2?gN(m.g2):'BYE';
      if(!m.g2){msg+=(i+1)+'. '+n1+' — BYE\n';return;}
      const ns1=ns[m.g1],ns2=ns[m.g2];
      if(ns1||ns2){
        const w=m.result==='tie'?'TIE':gN(m.result);
        msg+=(i+1)+'. '+n1+(ns1?' (NS)':'')+' vs '+n2+(ns2?' (NS)':'')+' → *'+w+'*\n';
      }else{
        const s1=wk.scores?.[m.g1],s2=wk.scores?.[m.g2];
        const g1=S.golfers.find(g=>g.id===m.g1),g2=S.golfers.find(g=>g.id===m.g2);
        const net1=s1&&g1?s1-eHcp(g1,S.weeks):null,net2=s2&&g2?s2-eHcp(g2,S.weeks):null;
        const w=m.result==='tie'?'TIE':m.result?gN(m.result):'TBD';
        msg+=(i+1)+'. '+n1+(s1?' ('+s1+'/net '+(net1||'?')+')':'')+' vs '+n2+(s2?' ('+s2+'/net '+(net2||'?')+')':'')+' → *'+w+'*\n';
      }
    });
    msg+='\n';
  }

  // Top 5 standings
  const rw=regW();
  const data=S.golfers.map(g=>{const rec=getRec(g.id,S.weeks.slice(0,rw));const tot=rec.w+rec.l+rec.t;const pct=tot>0?(rec.w+rec.t*.5)/tot:0;return{name:g.name,rec,pct,hcp:eHcp(g,S.weeks)};}).sort((a,b)=>b.pct-a.pct||b.rec.w-a.rec.w);
  msg+='📊 *Standings (Top 10):*\n';
  data.slice(0,10).forEach((g,i)=>{msg+=(i+1)+'. '+g.name+' ('+g.rec.w+'-'+g.rec.l+'-'+g.rec.t+') HCP:'+g.hcp+'\n';});

  msg+='\n🔗 Full standings: '+siteUrl();
  waShare(msg);
}

// Share: Scramble teams
function waScramble(wn){
  const wk=S.weeks.find(w=>w.wn===wn);if(!wk||!wk.scrambleTeams?.length)return;
  let msg='⛳ *The Wednesday Social*\n🏌️ *Scramble — Week '+wn+'* ('+fD(wk.date)+')\n\n';
  wk.scrambleTeams.forEach((team,ti)=>{
    const th=team.reduce((a,p)=>a+p.hcp,0);
    msg+='*Team '+(ti+1)+'* (HCP: '+th+')\n';
    team.forEach(p=>{msg+='  '+p.tier+': '+p.name+' ('+p.hcp+')\n';});
    msg+='\n';
  });
  msg+='🔗 '+siteUrl();
  waShare(msg);
}

// Share: Tournament bracket
function waTournament(){
  const t=S.tournament;if(!t)return;
  const rw=regW();
  const seeded=S.golfers.map(g=>{const r=getRec(g.id,S.weeks.slice(0,rw));const tot=r.w+r.l+r.t;const pct=tot>0?(r.w+r.t*.5)/tot:0;return{...g,rec:r,pct};}).sort((a,b)=>b.pct-a.pct||b.rec.w-a.rec.w).map((g,i)=>({...g,seed:i+1}));
  const gs=id=>seeded.find(g=>g.id===id)?.seed||'?';

  let msg='⛳ *The Wednesday Social*\n🏆 *Tournament Bracket Update*\n\n';

  for(let r=1;r<=t.totalRounds;r++){
    const rm=t.matches.filter(m=>m.round===r);
    const lbl=r===t.totalRounds?'Finals':r===t.totalRounds-1&&t.totalRounds>2?'Semis':'Round '+r;
    const hasData=rm.some(m=>m.g1||m.g2||m.isBye);
    if(!hasData)continue;
    msg+='*'+lbl+':*\n';
    rm.forEach(m=>{
      if(m.isBye){msg+='  ('+gs(m.winner)+') '+gN(m.winner)+' — BYE\n';}
      else{
        const n1=m.g1?'('+gs(m.g1)+') '+gN(m.g1):'TBD';
        const n2=m.g2?'('+gs(m.g2)+') '+gN(m.g2):'TBD';
        const w=m.winner?'→ *'+gN(m.winner)+'*':'';
        msg+='  '+n1+' vs '+n2+' '+w+'\n';
      }
    });
    msg+='\n';
  }

  if(t.champion)msg+='🏆 *Champion: '+t.champion+'*\n\n';
  msg+='🔗 Full bracket: '+siteUrl();
  waShare(msg);
}

loadData();

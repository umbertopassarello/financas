let calendarSelectedDate='';
function renderCalendar(){
  const year=activeYear(),month=DATA.currentMonth,txs=getYearData().months[MK[month]].transactions;
  const days=calendarDays(year,month,txs),max=Math.max(...days.map(d=>d.total),1);
  if(!days.some(d=>d.date===calendarSelectedDate))calendarSelectedDate=days.some(d=>d.date===localDate())?localDate():days[0].date;
  document.getElementById('calendarMonth').textContent=MONTHS[month]+' de '+year;
  const total=days.reduce((s,d)=>s+d.total,0),withoutDate=txs.filter(t=>t.tipo==='SAÍDA'&&!days.some(d=>d.date===t.data));
  document.getElementById('calendarSummary').textContent='Gastos com data neste mês: '+brl(total)+' · Inclui pagos e pendentes.'+(withoutDate.length?' '+withoutDate.length+' saída(s) sem data compatível, fora do calendário.':'');
  document.getElementById('calendarGrid').innerHTML=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<div class="calendar-weekday" role="columnheader">${d}</div>`).join('')+Array.from({length:new Date(year,month,1).getDay()},()=>'<div class="calendar-blank" aria-hidden="true"></div>').join('')+days.map(d=>`<button class="calendar-day ${d.date===localDate()?'is-today':''} ${d.date===calendarSelectedDate?'is-selected':''}" style="--day-intensity:${d.total>0?.05+d.total/max*.22:0}" aria-label="${d.day} de ${MONTHS[month]}: ${brl(d.total)} em gastos" aria-pressed="${d.date===calendarSelectedDate}" onclick="selectCalendarDate('${d.date}')"><span>${d.day}</span><strong>${brl(d.total)}</strong><small>${d.items.length} lançamento(s)</small></button>`).join('');
  const day=days.find(d=>d.date===calendarSelectedDate);
  document.getElementById('calendarDateTitle').textContent=calendarSelectedDate.split('-').reverse().join('/')+' · '+brl(day.total);
  document.getElementById('calendarDayList').innerHTML=day.items.length?day.items.map(t=>`<div class="calendar-transaction"><div><strong>${escapeHTML(t.desc)}</strong><div class="payment-badges">${paymentBadges(t)}</div></div><span>${brl(t.valor)}</span></div>`).join(''):'<p class="empty">Nenhum gasto neste dia.</p>';
}
function selectCalendarDate(date){calendarSelectedDate=date;renderCalendar();}

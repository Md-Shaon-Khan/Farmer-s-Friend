'use strict';

// ─── CONFIG ────────────────────────────────────
const API_BASE = 'http://127.0.0.1:8000';

// ─── CLASS DATA ────────────────────────────────
const CLASS_COLORS = {
    'Bacterial': { bg: '#fff5f5', text: '#991b1b', bar: '#ef4444', cardBg: '#fef2f2' },
    'Fungal':    { bg: '#fff8f0', text: '#92400e', bar: '#f59e0b', cardBg: '#fffbeb' },
    'Normal':    { bg: '#f0fdf4', text: '#166534', bar: '#22c55e', cardBg: '#dcfce7' },
    'Others':    { bg: '#fdf4ff', text: '#6b21a8', bar: '#8b5cf6', cardBg: '#f3e8ff' },
    'Viral':     { bg: '#fef2f2', text: '#7f1d1d', bar: '#ef4444', cardBg: '#fee2e2' }
};
const CLASS_LABELS_BN = { 'Bacterial':'ব্যাকটেরিয়াল','Fungal':'ছত্রাকজনিত','Normal':'স্বাভাবিক','Others':'পোকামাকড়','Viral':'ভাইরাসজনিত' };
const CLASS_ICONS = { 'Bacterial':'🦠','Fungal':'🍄','Normal':'✅','Others':'🐛','Viral':'⚠️' };

// ─── WEATHER CODE MAP ──────────────────────────
const weatherCodeMap = {
    0:{emoji:'☀️',label:'পরিষ্কার আকাশ'},1:{emoji:'🌤️',label:'প্রধানত পরিষ্কার'},
    2:{emoji:'⛅',label:'আংশিক মেঘলা'},3:{emoji:'☁️',label:'মেঘাচ্ছন্ন'},
    45:{emoji:'🌫️',label:'কুয়াশাচ্ছন্ন'},48:{emoji:'🌫️',label:'ঘন কুয়াশা'},
    51:{emoji:'🌦️',label:'হালকা গুঁড়িগুঁড়ি বৃষ্টি'},53:{emoji:'🌦️',label:'মাঝারি গুঁড়িগুঁড়ি'},
    55:{emoji:'🌧️',label:'ঘন গুঁড়িগুঁড়ি'},61:{emoji:'🌦️',label:'হালকা বৃষ্টি'},
    63:{emoji:'🌧️',label:'মাঝারি বৃষ্টি'},65:{emoji:'🌧️',label:'ভারী বৃষ্টি'},
    80:{emoji:'🌦️',label:'বৃষ্টির ঝাপটা'},81:{emoji:'🌧️',label:'মাঝারি ঝাপটা'},
    82:{emoji:'⛈️',label:'তীব্র ঝাপটা'},95:{emoji:'⛈️',label:'বজ্রঝড়'},
    96:{emoji:'⛈️',label:'শিলাবৃষ্টি সহ বজ্র'},99:{emoji:'⛈️',label:'তীব্র বজ্রঝড়'}
};
function getWeatherInfo(code) { return weatherCodeMap[code] || { emoji:'🌡️', label:'অজানা' }; }

function toBanglaNum(num) {
    const map = {'0':'০','1':'১','2':'২','3':'৩','4':'৪','5':'৫','6':'৬','7':'৭','8':'৮','9':'৯'};
    return String(num).replace(/[0-9]/g, d => map[d]);
}

const WEATHER_CACHE_KEY = 'kb_weather_cache';

function speakText(text) {
    if (!window.speechSynthesis || !text) return;
    const cleaned = String(text).replace(/<br>/gi, ' ').replace(/<[^>]+>/g, '').trim();
    if (!cleaned) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.lang = 'bn-BD';
    utter.rate = 0.95;
    utter.pitch = 1;
    const voices = speechSynthesis.getVoices();
    utter.voice = voices.find(v => v.lang.toLowerCase().startsWith('bn')) || voices.find(v => v.lang.toLowerCase().startsWith('en')) || null;
    window.speechSynthesis.speak(utter);
}

function speakSection(section) {
    if (!section) return;
    const title = section.querySelector('.section-title')?.textContent || '';
    const desc = section.querySelector('.section-desc')?.textContent || '';
    const extra = section.querySelector('.listen-text')?.textContent || '';
    const text = [title, desc, extra].filter(Boolean).join('. ');
    speakText(text);
}

function saveWeatherCache(payload) {
    try { localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(payload)); } catch (e) { }
}

function loadWeatherCache() {
    try { return JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)); } catch (e) { return null; }
}

function formatLastUpdated(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const hours = Math.round(diff / 3600000);
    return `শেষ আপডেট: ${toBanglaNum(hours)} ঘন্টা আগে`;
}

// ─── BANGLADESH ADMIN DATA ─────────────────────
const bdAdminData = {
    "ঢাকা":{ lat:23.8103,lng:90.4125, districts:{ "ঢাকা":{lat:23.8103,lng:90.4125,subdistricts:["সাভার","ধামরাই","কেরানীগঞ্জ","নবাবগঞ্জ","দোহার","তেজগাঁও","গুলশান","মিরপুর","মোহাম্মদপুর"]}, "গাজীপুর":{lat:23.9888,lng:90.3750,subdistricts:["গাজীপুর সদর","কালিয়াকৈর","শ্রীপুর","কাপাসিয়া","টঙ্গী"]}, "টাঙ্গাইল":{lat:24.2513,lng:89.9167,subdistricts:["টাঙ্গাইল সদর","নাগরপুর","দেলদুয়ার","বাসাইল","ভূয়াপুর","ঘাটাইল","গোপালপুর","কালিহাতী","মধুপুর","মির্জাপুর","ধনবাড়ী","সখিপুর"]}, "নারায়ণগঞ্জ":{lat:23.6238,lng:90.5000,subdistricts:["নারায়ণগঞ্জ সদর","বন্দর","রূপগঞ্জ","সোনারগাঁও","আড়াইহাজার"]}, "নরসিংদী":{lat:23.9135,lng:90.7178,subdistricts:["নরসিংদী সদর","রায়পুরা","বেলাবো","মনোহরদী","পলাশ","শিবপুর"]}, "মানিকগঞ্জ":{lat:23.8644,lng:90.0047,subdistricts:["মানিকগঞ্জ সদর","সিঙ্গাইর","শিবালয়","সাটুরিয়া","হরিরামপুর","ঘিওর","দৌলতপুর"]}, "মুন্সিগঞ্জ":{lat:23.5437,lng:90.5350,subdistricts:["মুন্সিগঞ্জ সদর","টঙ্গীবাড়ী","শ্রীনগর","লৌহজং","সিরাজদিখান","গজারিয়া"]}, "কিশোরগঞ্জ":{lat:24.4333,lng:90.7833,subdistricts:["কিশোরগঞ্জ সদর","বাজিতপুর","ভৈরব","হোসেনপুর","ইটনা","করিমগঞ্জ","কটিয়াদী","কুলিয়ারচর","মিঠামইন","নিকলী","পাকুন্দিয়া","তাড়াইল","অষ্টগ্রাম"]} } },
    "চট্টগ্রাম":{ lat:22.3569,lng:91.7832, districts:{ "চট্টগ্রাম":{lat:22.3569,lng:91.7832,subdistricts:["চট্টগ্রাম সদর","আনোয়ারা","বাঁশখালী","বোয়ালখালী","চন্দনাইশ","ফটিকছড়ি","হাটহাজারী","লোহাগড়া","মীরসরাই","রাঙ্গুনিয়া","রাউজান","সন্দ্বীপ","সাতকানিয়া","সীতাকুণ্ড"]}, "কক্সবাজার":{lat:21.4272,lng:92.0058,subdistricts:["কক্সবাজার সদর","উখিয়া","টেকনাফ","রামু","চকরিয়া","মহেশখালী","কুতুবদিয়া","পেকুয়া"]}, "কুমিল্লা":{lat:23.4607,lng:91.1809,subdistricts:["কুমিল্লা সদর","চান্দিনা","দাউদকান্দি","বুড়িচং","ব্রাহ্মণপাড়া","মুরাদনগর","দেবিদ্বার","বরুড়া","লাকসাম","নাঙ্গলকোট","হোমনা","তিতাস","মেঘনা","মনোহরগঞ্জ","চৌদ্দগ্রাম"]}, "নোয়াখালী":{lat:22.8200,lng:91.1000,subdistricts:["নোয়াখালী সদর","বেগমগঞ্জ","চাটখিল","কোম্পানীগঞ্জ","হাতিয়া","সেনবাগ","সুবর্ণচর","কবিরহাট"]}, "ফেনী":{lat:23.0159,lng:91.3976,subdistricts:["ফেনী সদর","সোনাগাজী","দাগনভুঁইয়া","পরশুরাম","ফুলগাজী","ছাগলনাইয়া"]} } },
    "রাজশাহী":{ lat:24.3636,lng:88.6241, districts:{ "রাজশাহী":{lat:24.3636,lng:88.6241,subdistricts:["রাজশাহী সদর","বোয়ালিয়া","মতিহার","পবা","গোদাগাড়ী","তানোর","মোহনপুর","বাগমারা","দুর্গাপুর","চারঘাট","পুঠিয়া"]}, "বগুড়া":{lat:24.8500,lng:89.3667,subdistricts:["বগুড়া সদর","শেরপুর","গাবতলী","ধুনট","শিবগঞ্জ","সোনাতলা","আদমদিঘী","কাহালু","নন্দীগ্রাম","সারিয়াকান্দি","দুপচাঁচিয়া"]}, "পাবনা":{lat:24.0000,lng:89.2500,subdistricts:["পাবনা সদর","ঈশ্বরদী","আটঘরিয়া","বেড়া","সাঁথিয়া","সুজানগর","ভাঙ্গুড়া","চাটমোহর","ফরিদপুর"]} } },
    "খুলনা":{ lat:22.8456,lng:89.5403, districts:{ "খুলনা":{lat:22.8456,lng:89.5403,subdistricts:["খুলনা সদর","দৌলতপুর","খালিশপুর","সোনাডাঙ্গা","ডুমুরিয়া","রূপসা","তেরখাদা","বটিয়াঘাটা","পাইকগাছা","কয়রা","দাকোপ"]}, "যশোর":{lat:23.1667,lng:89.2167,subdistricts:["যশোর সদর","ঝিকরগাছা","মনিরামপুর","কেশবপুর","বাঘারপাড়া","অভয়নগর","চৌগাছা","শার্শা"]}, "সাতক্ষীরা":{lat:22.7167,lng:89.0667,subdistricts:["সাতক্ষীরা সদর","আশাশুনি","দেবহাটা","কলারোয়া","কালিগঞ্জ","শ্যামনগর","তালা"]}, "কুষ্টিয়া":{lat:23.9000,lng:89.1333,subdistricts:["কুষ্টিয়া সদর","কুমারখালী","ভেড়ামারা","মিরপুর","খোকসা","দৌলতপুর"]} } },
    "বরিশাল":{ lat:22.7010,lng:90.3535, districts:{ "বরিশাল":{lat:22.7010,lng:90.3535,subdistricts:["বরিশাল সদর","বাকেরগঞ্জ","বাবুগঞ্জ","হিজলা","মুলাদী","মেহেন্দিগঞ্জ","বানারীপাড়া","আগৈলঝাড়া","গৌরনদী","উজিরপুর"]}, "পটুয়াখালী":{lat:22.3500,lng:90.3167,subdistricts:["পটুয়াখালী সদর","বাউফল","দশমিনা","গলাচিপা","কলাপাড়া","মির্জাগঞ্জ","দুমকি","রাঙ্গাবালী"]}, "ভোলা":{lat:22.6833,lng:90.6500,subdistricts:["ভোলা সদর","দৌলতখান","বোরহানউদ্দিন","লালমোহন","চরফ্যাশন","মনপুরা","তজুমদ্দিন"]} } },
    "সিলেট":{ lat:24.8949,lng:91.8687, districts:{ "সিলেট":{lat:24.8949,lng:91.8687,subdistricts:["সিলেট সদর","বিয়ানীবাজার","বিশ্বনাথ","কোম্পানীগঞ্জ","ফেঞ্চুগঞ্জ","গোলাপগঞ্জ","গোয়াইনঘাট","জৈন্তাপুর","কানাইঘাট","জকিগঞ্জ","বালাগঞ্জ","দক্ষিণ সুরমা"]}, "মৌলভীবাজার":{lat:24.4833,lng:91.7833,subdistricts:["মৌলভীবাজার সদর","শ্রীমঙ্গল","কমলগঞ্জ","কুলাউড়া","রাজনগর","জুড়ী","বড়লেখা"]}, "হবিগঞ্জ":{lat:24.3833,lng:91.4167,subdistricts:["হবিগঞ্জ সদর","চুনারুঘাট","মাধবপুর","নবীগঞ্জ","লাখাই","বানিয়াচং","আজমিরীগঞ্জ","শায়েস্তাগঞ্জ"]}, "সুনামগঞ্জ":{lat:25.0667,lng:91.4000,subdistricts:["সুনামগঞ্জ সদর","দিরাই","ছাতক","জগন্নাথপুর","ধর্মপাশা","তাহিরপুর","বিশ্বম্ভরপুর","দোয়ারাবাজার","সুল্লা","জামালগঞ্জ"]} } },
    "রংপুর":{ lat:25.7439,lng:89.2752, districts:{ "রংপুর":{lat:25.7439,lng:89.2752,subdistricts:["রংপুর সদর","বদরগঞ্জ","মিঠাপুকুর","পীরগাছা","পীরগঞ্জ","তারাগঞ্জ","কাউনিয়া","গঙ্গাচড়া"]}, "দিনাজপুর":{lat:25.6167,lng:88.6500,subdistricts:["দিনাজপুর সদর","বিরামপুর","বিরগঞ্জ","বোচাগঞ্জ","চিরিরবন্দর","ফুলবাড়ী","কাহারোল","খানসামা","নবাবগঞ্জ","পার্বতীপুর","হাকিমপুর","ঘোড়াঘাট"]}, "কুড়িগ্রাম":{lat:25.8167,lng:89.6500,subdistricts:["কুড়িগ্রাম সদর","নাগেশ্বরী","ভুরুঙ্গামারী","ফুলবাড়ী","রাজারহাট","উলিপুর","চিলমারী","রৌমারী","চর রাজিবপুর"]} } },
    "ময়মনসিংহ":{ lat:24.7471,lng:90.4203, districts:{ "ময়মনসিংহ":{lat:24.7471,lng:90.4203,subdistricts:["ময়মনসিংহ সদর","মুক্তাগাছা","ফুলবাড়িয়া","ত্রিশাল","ভালুকা","গফরগাঁও","ঈশ্বরগঞ্জ","নান্দাইল","ফুলপুর","হালুয়াঘাট","ধোবাউড়া","গৌরীপুর","তারাকান্দা"]}, "জামালপুর":{lat:24.9167,lng:89.9500,subdistricts:["জামালপুর সদর","মেলান্দহ","ইসলামপুর","দেওয়ানগঞ্জ","সরিষাবাড়ী","মাদারগঞ্জ","বকশীগঞ্জ"]}, "নেত্রকোণা":{lat:24.8833,lng:90.7333,subdistricts:["নেত্রকোণা সদর","আটপাড়া","কেন্দুয়া","মদন","মোহনগঞ্জ","খালিয়াজুড়ি","দুর্গাপুর","পূর্বধলা","বারহাট্টা","কলমাকান্দা"]} } }
};

// ─── NAVBAR ────────────────────────────────────
window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 40);
});
document.getElementById('navToggle').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('open');
});
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', () => document.getElementById('navLinks').classList.remove('open'));
});

// ─── FILE UPLOAD & DISEASE DETECT ─────────────
const fileInput = document.getElementById('fileInput');
const uploadZone = document.getElementById('uploadZone');
const uploadBtn = document.getElementById('uploadBtn');
const previewBox = document.getElementById('previewBox');
const previewImg = document.getElementById('previewImg');
const uploadStatus = document.getElementById('uploadStatus');
const resultEmpty = document.getElementById('resultEmpty');
const loadingOverlay = document.getElementById('loadingOverlay');
const resultContent = document.getElementById('resultContent');

uploadBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('dragover'); if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', () => { if(fileInput.files[0]) handleFile(fileInput.files[0]); });

function handleFile(file) {
    if (!file.type.startsWith('image/')) { uploadStatus.textContent = 'শুধুমাত্র ছবি ফাইল সমর্থিত।'; return; }
    const reader = new FileReader();
    reader.onload = e => { previewImg.src = e.target.result; previewBox.style.display = 'block'; uploadStatus.textContent = file.name + ' (' + (file.size/1024).toFixed(1) + ' KB)'; };
    reader.readAsDataURL(file);
    predictDisease(file);
}

async function predictDisease(file) {
    resultEmpty.style.display = 'none'; resultContent.style.display = 'none'; loadingOverlay.style.display = 'flex';
    try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(API_BASE + '/api/predict', { method:'POST', body:formData, signal:AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error('সার্ভার ত্রুটি: ' + response.status);
        renderResult(await response.json());
    } catch(err) {
        loadingOverlay.style.display = 'none'; resultEmpty.style.display = 'flex';
        resultEmpty.querySelector('.rp-title').textContent = 'সংযোগ ব্যর্থ হয়েছে';
        resultEmpty.querySelector('.rp-sub').textContent = 'অনুগ্রহ করে FastAPI সার্ভার চালু আছে কিনা নিশ্চিত করুন। (' + API_BASE + ')';
    }
}

function renderResult(data) {
    loadingOverlay.style.display = 'none'; resultContent.style.display = 'flex';
    const cls = data.disease_en; const colors = CLASS_COLORS[cls] || CLASS_COLORS['Normal'];
    const header = document.getElementById('resultDiseaseCard'); header.style.background = colors.bg;
    const iconEl = document.getElementById('resultIcon'); iconEl.textContent = CLASS_ICONS[cls] || '🌾'; iconEl.style.background = colors.cardBg;
    document.getElementById('resultName').textContent = CLASS_LABELS_BN[cls] || cls; document.getElementById('resultName').style.color = colors.text;
    document.getElementById('resultBn').textContent = data.disease_bn; document.getElementById('resultBn').style.color = colors.text;
    document.getElementById('resultConf').textContent = 'নির্ভুলতা: ' + data.confidence.toFixed(1) + '%'; document.getElementById('resultConf').style.background = colors.cardBg; document.getElementById('resultConf').style.color = colors.text;
    document.getElementById('resultSeverity').textContent = 'তীব্রতা: ' + data.severity; document.getElementById('resultSeverity').style.background = colors.cardBg; document.getElementById('resultSeverity').style.color = colors.text;
    const probsDiv = document.getElementById('resultProbs'); probsDiv.innerHTML = '';
    data.all_classes.forEach((label, i) => {
        const pct = (data.probabilities[i]*100).toFixed(1); const c = CLASS_COLORS[label] || { bar:'#6b7280' }; const bn = CLASS_LABELS_BN[label] || label;
        const row = document.createElement('div'); row.className = 'result-prob-row';
        row.innerHTML = `<span class="result-prob-label">${bn}</span><div class="result-prob-track"><div class="result-prob-fill" style="width:0%;background:${c.bar}" data-width="${pct}"></div></div><span class="result-prob-pct">${pct}%</span>`;
        probsDiv.appendChild(row);
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
        probsDiv.querySelectorAll('.result-prob-fill').forEach(el => { el.style.width = el.dataset.width + '%'; });
    }));
    const descCard = document.getElementById('resultDescCard'); descCard.style.background = colors.bg;
    document.getElementById('resultDesc').textContent = data.description; document.getElementById('resultDesc').style.color = colors.text; descCard.querySelector('.rc-label').style.color = colors.text;
    const treatCard = document.getElementById('resultTreatCard'); treatCard.style.background = '#fffbeb';
    document.getElementById('resultTreat').textContent = data.treatment; document.getElementById('resultTreat').style.color = '#92400e'; treatCard.querySelector('.rc-label').style.color = '#92400e';
    const diseaseName = data.disease_bn || data.disease_en || 'রোগ';
    const nextStep = data.treatment ? data.treatment.split('. ')[0] : 'পরামর্শ অনুযায়ী কাজ করুন';
    speakText(`আপনার ধানে ${diseaseName} রোগ হয়েছে। ${nextStep}.`);
}

// ─── MAP ───────────────────────────────────────
let weatherMap = null, weatherMarker = null;
let selectedCoords = null, selectedLocationName = '';

function initMap() {
    if (weatherMap) return;
    weatherMap = L.map('weatherMap', { zoomControl:true }).setView([23.6850, 90.3563], 7);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution:'Esri World Imagery | NASA Landsat', maxZoom:19 }).addTo(weatherMap);
    L.circle([23.6850, 90.3563], { radius:450000, color:'#3d8b40', fillColor:'#3d8b40', fillOpacity:0.04, weight:1.5, dashArray:'6 4' }).addTo(weatherMap);
}

function updateMap(lat, lng, name) {
    if (!weatherMap) initMap();
    weatherMap.flyTo([lat, lng], 12, { duration:1.2 });
    if (weatherMarker) weatherMap.removeLayer(weatherMarker);
    const customIcon = L.divIcon({ className:'', html:`<div style="width:14px;height:14px;background:#3d8b40;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(61,139,64,0.3);"></div>`, iconSize:[14,14], iconAnchor:[7,7] });
    weatherMarker = L.marker([lat, lng], { icon:customIcon }).addTo(weatherMap).bindPopup(`<strong>${name}</strong><br><small>${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</small>`).openPopup();
    document.getElementById('mapCoords').innerHTML = `স্থানাঙ্ক: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E &nbsp;|&nbsp; ${name}`;
}

// ─── DIVISION/DISTRICT/SUBDISTRICT ────────────
const divisionSelect = document.getElementById('divisionSelect');
const districtSelect = document.getElementById('districtSelect');
const subdistrictSelect = document.getElementById('subdistrictSelect');
const fetchWeatherBtn = document.getElementById('fetchWeatherBtn');
const selectedLocInfo = document.getElementById('selectedLocationInfo');

(function populateDivisions() {
    Object.keys(bdAdminData).forEach(div => { const opt = document.createElement('option'); opt.value = div; opt.textContent = div + ' বিভাগ'; divisionSelect.appendChild(opt); });
})();

divisionSelect.addEventListener('change', function() {
    const div = this.value;
    districtSelect.innerHTML = '<option value="">-- জেলা নির্বাচন করুন --</option>';
    subdistrictSelect.innerHTML = '<option value="">-- উপজেলা নির্বাচন করুন --</option>';
    subdistrictSelect.disabled = true; fetchWeatherBtn.disabled = true; selectedCoords = null;
    selectedLocInfo.innerHTML = '<span>বিভাগ থেকে শুরু করুন এবং ধাপে ধাপে নির্বাচন করুন</span>';
    resetWeatherDisplay();
    if (div && bdAdminData[div]) {
        districtSelect.disabled = false;
        Object.keys(bdAdminData[div].districts).forEach(dist => { const opt = document.createElement('option'); opt.value = dist; opt.textContent = dist + ' জেলা'; districtSelect.appendChild(opt); });
        if (!weatherMap) initMap();
        weatherMap.flyTo([bdAdminData[div].lat, bdAdminData[div].lng], 9, { duration:1 });
        document.getElementById('mapCoords').innerHTML = `বিভাগ: ${div} &nbsp;|&nbsp; ${bdAdminData[div].lat.toFixed(4)}°N, ${bdAdminData[div].lng.toFixed(4)}°E`;
    } else { districtSelect.disabled = true; if(weatherMap) weatherMap.flyTo([23.6850, 90.3563], 7, { duration:1 }); }
});

districtSelect.addEventListener('change', function() {
    const div = divisionSelect.value; const dist = this.value;
    subdistrictSelect.innerHTML = '<option value="">-- উপজেলা নির্বাচন করুন --</option>';
    fetchWeatherBtn.disabled = true; selectedCoords = null;
    selectedLocInfo.innerHTML = '<span>উপজেলা নির্বাচন করুন</span>'; resetWeatherDisplay();
    if (div && dist && bdAdminData[div]?.districts[dist]) {
        subdistrictSelect.disabled = false;
        const distData = bdAdminData[div].districts[dist];
        distData.subdistricts.forEach(sub => { const opt = document.createElement('option'); opt.value = sub; opt.textContent = sub; subdistrictSelect.appendChild(opt); });
        if (!weatherMap) initMap();
        weatherMap.flyTo([distData.lat, distData.lng], 10, { duration:1 });
        document.getElementById('mapCoords').innerHTML = `জেলা: ${dist}, ${div} &nbsp;|&nbsp; ${distData.lat.toFixed(4)}°N, ${distData.lng.toFixed(4)}°E`;
    } else { subdistrictSelect.disabled = true; }
});

subdistrictSelect.addEventListener('change', function() {
    const div = divisionSelect.value; const dist = districtSelect.value; const sub = this.value;
    if (div && dist && sub && bdAdminData[div]?.districts[dist]) {
        const distData = bdAdminData[div].districts[dist];
        const latOff = (Math.random()-0.5)*0.04; const lngOff = (Math.random()-0.5)*0.04;
        selectedCoords = { lat:distData.lat+latOff, lng:distData.lng+lngOff };
        selectedLocationName = `${sub}, ${dist}, ${div}`;
        fetchWeatherBtn.disabled = false;
        selectedLocInfo.innerHTML = `<span style="color:#15803d;">নির্বাচিত: <strong>${selectedLocationName}</strong></span>`;
        updateMap(selectedCoords.lat, selectedCoords.lng, selectedLocationName); resetWeatherDisplay();
    } else { fetchWeatherBtn.disabled = true; selectedCoords = null; selectedLocInfo.innerHTML = '<span>উপজেলা নির্বাচন করুন</span>'; resetWeatherDisplay(); }
});

fetchWeatherBtn.addEventListener('click', () => { if(selectedCoords && selectedLocationName) fetchWeatherData(selectedCoords.lat, selectedCoords.lng, selectedLocationName); });

const upazilaSearchBtn = document.getElementById('upazilaSearchBtn');
const upazilaOverlay = document.getElementById('upazilaOverlay');
const upazilaCloseBtn = document.getElementById('upazilaCloseBtn');
const upazilaDivisionSelect = document.getElementById('upazilaDivisionSelect');
const upazilaDistrictSelect = document.getElementById('upazilaDistrictSelect');
const upazilaSubdistrictSelect = document.getElementById('upazilaSubdistrictSelect');
const upazilaLookupBtn = document.getElementById('upazilaLookupBtn');
const upazilaResult = document.getElementById('upazilaResult');
const upazilaResultName = document.getElementById('upazilaResultName');
const upazilaResultOffice = document.getElementById('upazilaResultOffice');
const upazilaResultPhone = document.getElementById('upazilaResultPhone');

const upazilaOfficePhones = {
    'ঢাকা':'০১৭১১১২২২৩৩', 'চট্টগ্রাম':'০১৯২২২৩৩৪৪৪', 'রাজশাহী':'০১৮৩৩৩৪৪৫৫৫',
    'খুলনা':'০১৮৪৪৪৫৫৬৬৬', 'বরিশাল':'০১৯৫৫৫৬৬৭৭৭', 'সিলেট':'০১৮৬৬৬৭৭৮৮৮',
    'রংপুর':'০১৭৭৭৭৮৮৯৯', 'ময়মনসিংহ':'০১৯৮৮৮৯৯০০০'
};

function populateUpazilaModal() {
    upazilaDivisionSelect.innerHTML = '<option value="">-- বিভাগ নির্বাচন করুন --</option>';
    Object.keys(bdAdminData).forEach(div => {
        const opt = document.createElement('option'); opt.value = div;
        opt.textContent = div + ' বিভাগ'; upazilaDivisionSelect.appendChild(opt);
    });
}

function resetUpazilaModal() {
    upazilaDivisionSelect.value = '';
    upazilaDistrictSelect.innerHTML = '<option value="">-- জেলা নির্বাচন করুন --</option>';
    upazilaSubdistrictSelect.innerHTML = '<option value="">-- উপজেলা নির্বাচন করুন --</option>';
    upazilaDistrictSelect.disabled = true;
    upazilaSubdistrictSelect.disabled = true;
    upazilaLookupBtn.disabled = true;
    upazilaResult.style.display = 'none';
    upazilaResultName.textContent = '';
    upazilaResultOffice.textContent = '';
    upazilaResultPhone.textContent = '';
}

function openUpazilaModal() {
    populateUpazilaModal();
    resetUpazilaModal();
    upazilaOverlay.classList.add('open');
}

function closeUpazilaModal() {
    upazilaOverlay.classList.remove('open');
}

function showUpazilaContact() {
    const div = upazilaDivisionSelect.value;
    const dist = upazilaDistrictSelect.value;
    const sub = upazilaSubdistrictSelect.value;
    if (!div || !dist || !sub) return;
    const phone = upazilaOfficePhones[div] || '০১৭০০০০০০০০';
    upazilaResultName.textContent = `${sub} উপজেলা কৃষি অফিস`;
    upazilaResultOffice.textContent = `ঠিকানা: ${sub}, ${dist}, ${div}`;
    upazilaResultPhone.innerHTML = `ফোন: <strong>${phone}</strong>`;
    upazilaResult.style.display = 'block';
}

upazilaSearchBtn.addEventListener('click', openUpazilaModal);
upazilaCloseBtn.addEventListener('click', closeUpazilaModal);
upazilaOverlay.addEventListener('click', e => { if (e.target === upazilaOverlay) closeUpazilaModal(); });

upazilaDivisionSelect.addEventListener('change', function() {
    const div = this.value;
    upazilaDistrictSelect.innerHTML = '<option value="">-- জেলা নির্বাচন করুন --</option>';
    upazilaSubdistrictSelect.innerHTML = '<option value="">-- উপজেলা নির্বাচন করুন --</option>';
    upazilaDistrictSelect.disabled = !div;
    upazilaSubdistrictSelect.disabled = true;
    upazilaLookupBtn.disabled = true;
    upazilaResult.style.display = 'none';
    if (div && bdAdminData[div]) {
        Object.keys(bdAdminData[div].districts).forEach(dist => {
            const opt = document.createElement('option'); opt.value = dist;
            opt.textContent = dist + ' জেলা'; upazilaDistrictSelect.appendChild(opt);
        });
    }
});

upazilaDistrictSelect.addEventListener('change', function() {
    const div = upazilaDivisionSelect.value;
    const dist = this.value;
    upazilaSubdistrictSelect.innerHTML = '<option value="">-- উপজেলা নির্বাচন করুন --</option>';
    upazilaSubdistrictSelect.disabled = !dist;
    upazilaLookupBtn.disabled = true;
    upazilaResult.style.display = 'none';
    if (div && dist && bdAdminData[div]?.districts[dist]) {
        bdAdminData[div].districts[dist].subdistricts.forEach(sub => {
            const opt = document.createElement('option'); opt.value = sub; opt.textContent = sub;
            upazilaSubdistrictSelect.appendChild(opt);
        });
    }
});

upazilaSubdistrictSelect.addEventListener('change', function() {
    upazilaLookupBtn.disabled = !this.value;
    upazilaResult.style.display = 'none';
});

upazilaLookupBtn.addEventListener('click', showUpazilaContact);

function resetWeatherDisplay() {
    document.getElementById('weatherPlaceholder').style.display = 'flex';
    document.getElementById('weatherLoading').style.display = 'none';
    document.getElementById('weatherError').style.display = 'none';
    document.getElementById('weatherCardsGrid').style.display = 'none';
    document.getElementById('weatherCardsGrid').innerHTML = '';
    document.getElementById('weatherSummaryContent').innerHTML = '<em>অবস্থান নির্বাচন করলে সারসংক্ষেপ দেখা যাবে</em>';
    document.getElementById('weatherLastUpdated').textContent = '';
}

async function fetchWeatherData(lat, lng, locationName) {
    document.getElementById('weatherPlaceholder').style.display = 'none';
    document.getElementById('weatherCardsGrid').style.display = 'none';
    document.getElementById('weatherError').style.display = 'none';
    document.getElementById('weatherLoading').style.display = 'flex';
    document.getElementById('weatherCardsGrid').innerHTML = '';
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,relative_humidity_2m_max,weather_code&timezone=Asia/Dhaka&forecast_days=16`;
        const response = await fetch(url, { signal:AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('API ত্রুটি: ' + response.status);
        const json = await response.json();
        saveWeatherCache({ data: json, locationName, lat, lng, updated: Date.now() });
        renderWeatherCards(json, locationName, lat, lng, Date.now());
    } catch(err) {
        const cached = loadWeatherCache();
        if (cached) {
            renderWeatherCards(cached.data, cached.locationName, cached.lat, cached.lng, cached.updated, true);
            return;
        }
        document.getElementById('weatherLoading').style.display = 'none';
        document.getElementById('weatherError').style.display = 'flex';
        document.getElementById('weatherErrorMsg').textContent = err.message + ' — পুনরায় চেষ্টা করুন।';
    }
}

function renderWeatherCards(data, locationName, lat, lng, lastUpdated = null, offline = false) {
    document.getElementById('weatherLoading').style.display = 'none';
    document.getElementById('weatherError').style.display = 'none';
    const grid = document.getElementById('weatherCardsGrid');
    grid.style.display = 'grid'; grid.innerHTML = '';
    const { time:dates, temperature_2m_max:maxTemps, temperature_2m_min:minTemps, precipitation_sum:precip, precipitation_probability_max:precipProb, wind_speed_10m_max:windSpeed, relative_humidity_2m_max:humidity, weather_code:codes } = data.daily;
    const avgMax = (maxTemps.reduce((a,b)=>a+b,0)/maxTemps.length).toFixed(1);
    const avgMin = (minTemps.reduce((a,b)=>a+b,0)/minTemps.length).toFixed(1);
    const totalRain = precip.reduce((a,b)=>a+b,0).toFixed(1);
    const rainyDays = precip.filter(p=>p>1).length;
    document.getElementById('weatherSummaryContent').innerHTML = `
        <div class="ws-row"><strong>অবস্থান</strong><span>${locationName}</span></div>
        <div class="ws-row"><strong>সময়কাল</strong><span>${dates[0]} থেকে ${dates[dates.length-1]}</span></div>
        <div class="ws-row"><strong>গড় সর্বোচ্চ তাপমাত্রা</strong><span>${toBanglaNum(avgMax)}°C</span></div>
        <div class="ws-row"><strong>গড় সর্বনিম্ন তাপমাত্রা</strong><span>${toBanglaNum(avgMin)}°C</span></div>
        <div class="ws-row"><strong>মোট বৃষ্টিপাত</strong><span>${toBanglaNum(totalRain)} মিমি</span></div>
        <div class="ws-row"><strong>বৃষ্টির দিন</strong><span>${toBanglaNum(rainyDays)} / ${toBanglaNum(dates.length)} দিন</span></div>`;
    const dayNamesBn = { Mon:'সোম',Tue:'মঙ্গল',Wed:'বুধ',Thu:'বৃহঃ',Fri:'শুক্র',Sat:'শনি',Sun:'রবি' };
    const monthsBn = { Jan:'জানু',Feb:'ফেব্রু',Mar:'মার্চ',Apr:'এপ্রি',May:'মে',Jun:'জুন',Jul:'জুলাই',Aug:'আগস্ট',Sep:'সেপ্টে',Oct:'অক্টো',Nov:'নভে',Dec:'ডিসে' };
    dates.forEach((dateStr, i) => {
        const wInfo = getWeatherInfo(codes[i]); const dateObj = new Date(dateStr+'T00:00:00');
        const dayEn = dateObj.toLocaleDateString('en-US',{weekday:'short'}); const monEn = dateObj.toLocaleDateString('en-US',{month:'short'});
        const dayBn = dayNamesBn[dayEn]||dayEn; const monBn = monthsBn[monEn]||monEn; const dayNum = dateObj.getDate();
        const rainLevel = precip[i]>10?'high-rain':precip[i]>2?'mid-rain':'';
        const card = document.createElement('div'); card.className = 'weather-day-card';
        card.innerHTML = `<div class="wdc-date"><span class="wdc-day">${dayBn}</span><span class="wdc-monthday">${monBn} ${toBanglaNum(dayNum)}</span></div><div class="wdc-icon">${wInfo.emoji}</div><div class="wdc-condition">${wInfo.label}</div><div class="wdc-temps"><span class="wdc-high">${toBanglaNum(maxTemps[i].toFixed(0))}°</span><span style="color:#d1d5db;font-size:11px;">|</span><span class="wdc-low">${toBanglaNum(minTemps[i].toFixed(0))}°</span></div><div class="wdc-details"><div class="wdc-detail ${rainLevel}">${toBanglaNum(precip[i].toFixed(1))} মিমি</div><div class="wdc-detail">${toBanglaNum(humidity[i])}% আর্দ্রতা</div><div class="wdc-detail">${toBanglaNum(windSpeed[i].toFixed(0))} কি.মি./ঘন্টা</div></div><div class="wdc-rainprob">বৃষ্টির সম্ভাবনা ${toBanglaNum(precipProb[i])}%</div>`;
        grid.appendChild(card);
    });
    setTimeout(() => document.getElementById('weatherCardsContainer').scrollIntoView({ behavior:'smooth', block:'nearest' }), 150);
}

// ─── MAP INIT ON LOAD ──────────────────────────
document.addEventListener('DOMContentLoaded', () => { initMap(); });
const weatherSection = document.getElementById('weather-forecast');
if (weatherSection) {
    const io = new IntersectionObserver(entries => { entries.forEach(e => { if(e.isIntersecting){ initMap(); io.unobserve(weatherSection); } }); }, { threshold:0.1 });
    io.observe(weatherSection);
}

// ══════════════════════════════════════════════
// ─── CROP CALENDAR ────────────────────────────
// ══════════════════════════════════════════════

const CROP_STAGES = {
    boro: [
        { name:'বীজতলা তৈরি', days:[0,25], emoji:'🌱', tasks:['বীজ শোধন করুন','বীজতলায় সার দিন','নিয়মিত সেচ দিন','আগাছা পরিষ্কার করুন'] },
        { name:'চারা রোপণ', days:[25,30], emoji:'🌿', tasks:['৪-৫ পাতার চারা রোপণ করুন','সারি থেকে সারি ২৫ সেমি','চারা থেকে চারা ১৫ সেমি','রোপণের পর সেচ দিন'] },
        { name:'কুশি আসা', days:[30,55], emoji:'🌾', tasks:['ইউরিয়া সার (২য় কিস্তি) দিন','জমিতে পানি ধরে রাখুন','আগাছা দমন করুন','পোকামাকড় পর্যবেক্ষণ করুন'] },
        { name:'থোড় আসা', days:[55,75], emoji:'🌻', tasks:['পটাশ সার দিন','ইউরিয়া (৩য় কিস্তি) দিন','পানির স্তর ৫-১০ সেমি রাখুন','ব্লাস্ট রোগের দিকে মনোযোগ দিন'] },
        { name:'ফুল ফোটা', days:[75,90], emoji:'🌸', tasks:['জমিতে পানি রাখুন','কীটনাশক প্রয়োগ সাবধানে করুন','বাতাস ও তাপমাত্রা পর্যবেক্ষণ করুন'] },
        { name:'দুধ অবস্থা', days:[90,110], emoji:'🌾', tasks:['সেচ চালু রাখুন','শীষকাটা পোকা দমন করুন','ধানের রং পর্যবেক্ষণ করুন'] },
        { name:'পাকা ধান', days:[110,135], emoji:'🟡', tasks:['৮০% ধান হলুদ হলে কাটুন','কাটার আগে পানি সরিয়ে নিন','শুষ্ক আবহাওয়ায় কাটুন','দ্রুত মাড়াই করুন'] }
    ],
    amon: [
        { name:'বীজতলা তৈরি', days:[0,20], emoji:'🌱', tasks:['বীজ শোধন করুন (কার্বেন্ডাজিম)','বীজতলায় সার দিন','নিয়মিত সেচ দিন'] },
        { name:'চারা রোপণ', days:[20,25], emoji:'🌿', tasks:['২৫-৩০ দিনের চারা রোপণ করুন','বৃষ্টির পানিতে রোপণ করুন','সারি ২৫×২০ সেমি'] },
        { name:'কুশি আসা', days:[25,50], emoji:'🌾', tasks:['ইউরিয়া সার (২য় কিস্তি) দিন','বন্যার পানি নামলে সেচ দিন','আগাছা দমন করুন'] },
        { name:'থোড় আসা', days:[50,70], emoji:'🌻', tasks:['শেষ কিস্তি ইউরিয়া দিন','পানি ধরে রাখুন','ঘূর্ণিঝড় পূর্বাভাস দেখুন'] },
        { name:'ফুল ফোটা', days:[70,85], emoji:'🌸', tasks:['জমিতে পানি রাখুন','কুয়াশা থেকে সাবধান থাকুন'] },
        { name:'পাকা ধান', days:[85,115], emoji:'🟡', tasks:['অক্টোবর-নভেম্বরে কাটুন','শুষ্ক মৌসুমে দ্রুত মাড়াই করুন'] }
    ],
    aus: [
        { name:'বীজতলা তৈরি', days:[0,20], emoji:'🌱', tasks:['এপ্রিল-মে মাসে বীজতলা করুন','সেচ ও আগাছা দমন করুন'] },
        { name:'চারা রোপণ', days:[20,25], emoji:'🌿', tasks:['মে মাসে রোপণ করুন','কম বয়সের চারা লাগান (২০ দিন)'] },
        { name:'কুশি আসা', days:[25,45], emoji:'🌾', tasks:['সার ও সেচ দিন','আগাছা দমন করুন'] },
        { name:'থোড়-পাকা', days:[45,90], emoji:'🌾', tasks:['নিয়মিত পানি দিন','জুলাই-আগস্টে কাটুন'] }
    ]
};

let selectedCalSeason = 'boro';

document.querySelectorAll('.season-tab[data-season]').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.season-tab[data-season]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        selectedCalSeason = this.dataset.season;
    });
});

document.getElementById('generateCalendarBtn').addEventListener('click', generateCalendar);

function generateCalendar() {
    const sowingDateVal = document.getElementById('sowingDate').value;
    if (!sowingDateVal) { alert('অনুগ্রহ করে বপনের তারিখ দিন'); return; }
    const sowingDate = new Date(sowingDateVal);
    const today = new Date(); today.setHours(0,0,0,0);
    const stages = CROP_STAGES[selectedCalSeason];
    const timeline = document.getElementById('calendarTimeline');
    const stageInfoBody = document.getElementById('stageInfoBody');

    // Find current stage
    const daysElapsed = Math.floor((today - sowingDate) / (1000*60*60*24));
    let currentStageIdx = -1;
    stages.forEach((s, i) => { if (daysElapsed >= s.days[0] && daysElapsed < s.days[1]) currentStageIdx = i; });
    if (daysElapsed < 0) currentStageIdx = -2; // future
    if (daysElapsed >= stages[stages.length-1].days[1]) currentStageIdx = -3; // harvested

    // Render timeline
    const seasonNames = { boro:'বোরো', amon:'আমন', aus:'আউশ' };
    let html = `<div class="timeline-head">${seasonNames[selectedCalSeason]} মৌসুম ফসল পঞ্জিকা — বপন: ${sowingDate.toLocaleDateString('bn-BD')}</div><div class="timeline-stages">`;
    stages.forEach((stage, i) => {
        const stageStart = new Date(sowingDate); stageStart.setDate(sowingDate.getDate() + stage.days[0]);
        const stageEnd = new Date(sowingDate); stageEnd.setDate(sowingDate.getDate() + stage.days[1]);
        let status = 'future', markerClass = 'future', badgeText = 'আগামী';
        if (i < currentStageIdx) { status='past'; markerClass='past'; badgeText='সম্পন্ন'; }
        else if (i === currentStageIdx) { status='active'; markerClass='active'; badgeText='এখন'; }
        const taskPills = stage.tasks.map(t => `<span class="ts-task-pill${status==='active'?' active':''}">${t}</span>`).join('');
        html += `<div class="timeline-stage"><div class="ts-marker ${markerClass}">${stage.emoji}</div><div class="ts-content"><div class="ts-header"><span class="ts-name">${stage.name}</span><span class="ts-day-range">দিন ${stage.days[0]}–${stage.days[1]}</span><span class="ts-status-badge ${status}">${badgeText}</span></div><div style="font-size:12px;color:var(--pebble);margin-bottom:8px;">${stageStart.toLocaleDateString('bn-BD')} — ${stageEnd.toLocaleDateString('bn-BD')}</div><div class="ts-tasks">${taskPills}</div></div></div>`;
    });
    html += '</div>';
    timeline.innerHTML = html;

    // Render current stage info
    if (currentStageIdx === -2) {
        stageInfoBody.innerHTML = `<em>বপনের সময় এখনো আসেনি। ${Math.abs(daysElapsed)} দিন বাকি।</em>`;
    } else if (currentStageIdx === -3) {
        stageInfoBody.innerHTML = `<div class="current-stage-info"><span class="csi-badge">✅ ফসল সম্পন্ন</span><div class="csi-stage">ফসল সংগ্রহ শেষ হয়েছে</div><div style="font-size:13px;color:var(--stone);margin-top:8px;">পরের মৌসুমের প্রস্তুতি নিন। জমি চাষ করুন এবং পরবর্তী বীজতলার পরিকল্পনা করুন।</div></div>`;
    } else if (currentStageIdx >= 0) {
        const cs = stages[currentStageIdx];
        const taskItems = cs.tasks.map(t => `<div class="csi-task"><span class="csi-task-icon">✓</span><span>${t}</span></div>`).join('');
        stageInfoBody.innerHTML = `<div class="current-stage-info"><span class="csi-badge">বর্তমান পর্যায়</span><div class="csi-day">${toBanglaNum(daysElapsed)} তম দিন</div><div class="csi-stage">${cs.emoji} ${cs.name}</div><div class="csi-tasks">${taskItems}</div></div>`;
    } else {
        stageInfoBody.innerHTML = '<em>তারিখ দিয়ে পঞ্জিকা তৈরি করুন</em>';
    }
}

// ══════════════════════════════════════════════
// ─── FERTILIZER CALCULATOR ────────────────────
// ══════════════════════════════════════════════

// Base fertilizer rates per acre (kg) for HYV Boro
const FERT_BASE = {
    boro: { hv: { urea:180, dap:100, mop:60, gypsum:60 }, hybrid: { urea:210, dap:120, mop:75, gypsum:60 }, local: { urea:120, dap:70, mop:40, gypsum:40 } },
    amon: { hv: { urea:130, dap:80, mop:50, gypsum:40 }, hybrid: { urea:160, dap:100, mop:60, gypsum:40 }, local: { urea:90, dap:55, mop:35, gypsum:30 } },
    aus:  { hv: { urea:110, dap:70, mop:40, gypsum:30 }, hybrid: { urea:140, dap:90, mop:55, gypsum:30 }, local: { urea:80, dap:50, mop:30, gypsum:25 } }
};
// Soil multipliers
const SOIL_MULT = { clay:1.0, loam:0.9, sandy:1.15, silt:0.85 };
// Land unit to acre conversion
const TO_ACRE = { shotangsh:0.01, bigha:0.33, acre:1, hectare:2.47 };

const FERT_COLORS = {
    urea:    { bg:'#f0fdf4', border:'#bbf7d0', text:'#15803d', icon:'🧪' },
    dap:     { bg:'#eff6ff', border:'#bfdbfe', text:'#1d4ed8', icon:'💊' },
    mop:     { bg:'#fff7ed', border:'#fed7aa', text:'#c2410c', icon:'🔴' },
    gypsum:  { bg:'#fdf4ff', border:'#e9d5ff', text:'#7e22ce', icon:'⚪' }
};

const DOSE_SCHEDULE = [
    { time:'জমি তৈরির সময়', urea:'১/৪ ভাগ', dap:'সম্পূর্ণ', mop:'১/২ ভাগ', gypsum:'সম্পূর্ণ' },
    { time:'রোপণের ১৫-২০ দিন পর', urea:'১/৪ ভাগ', dap:'—', mop:'—', gypsum:'—' },
    { time:'রোপণের ৩০-৩৫ দিন পর', urea:'১/৪ ভাগ', dap:'—', mop:'১/২ ভাগ', gypsum:'—' },
    { time:'থোড় আসার সময়', urea:'১/৪ ভাগ', dap:'—', mop:'—', gypsum:'—' }
];

let selectedFertSeason = 'boro', selectedSoil = 'clay';

document.querySelectorAll('.season-tab[data-fert-season]').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.season-tab[data-fert-season]').forEach(b => b.classList.remove('active'));
        this.classList.add('active'); selectedFertSeason = this.dataset.fertSeason;
    });
});

document.querySelectorAll('.soil-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.soil-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active'); selectedSoil = this.dataset.soil;
    });
});

document.getElementById('calcFertBtn').addEventListener('click', calculateFertilizer);

function calculateFertilizer() {
    const landAmount = parseFloat(document.getElementById('landAmount').value) || 1;
    const landUnit = document.getElementById('landUnit').value;
    const variety = document.getElementById('fertRiceVariety').value;
    const acreFactor = landAmount * TO_ACRE[landUnit];
    const soilMult = SOIL_MULT[selectedSoil];
    const base = FERT_BASE[selectedFertSeason][variety];

    const doses = {
        urea:   Math.round(base.urea * acreFactor * soilMult),
        dap:    Math.round(base.dap * acreFactor * soilMult),
        mop:    Math.round(base.mop * acreFactor * soilMult),
        gypsum: Math.round(base.gypsum * acreFactor * soilMult)
    };

    const fertResults = document.getElementById('fertResults');
    const fertPlaceholder = document.querySelector('.fert-placeholder');
    fertPlaceholder.style.display = 'none';
    fertResults.style.display = 'block';

    const soilNames = { clay:'এঁটেল', loam:'দোআঁশ', sandy:'বেলে', silt:'পলি' };
    const varNames = { hv:'উফশী (HYV)', hybrid:'হাইব্রিড', local:'স্থানীয়' };
    const seasonNames = { boro:'বোরো', amon:'আমন', aus:'আউশ' };
    document.getElementById('fertResultHead').innerHTML = `${seasonNames[selectedFertSeason]} মৌসুম — ${varNames[variety]} — ${soilNames[selectedSoil]} মাটি — ${landAmount} ${landUnit} (${acreFactor.toFixed(2)} একর)`;

    // Dose cards
    const doseNames = { urea:'ইউরিয়া', dap:'ডিএপি', mop:'এমওপি', gypsum:'জিপসাম' };
    document.getElementById('fertDoseGrid').innerHTML = Object.entries(doses).map(([name, amount]) => {
        const c = FERT_COLORS[name];
        return `<div class="fert-dose-card" style="background:${c.bg};border:1px solid ${c.border};">
            <div class="fdc-icon">${c.icon}</div>
            <div class="fdc-name" style="color:${c.text};">${doseNames[name]}</div>
            <div class="fdc-amount" style="color:${c.text};">${toBanglaNum(amount)}</div>
            <div class="fdc-unit" style="color:${c.text};">কেজি</div>
        </div>`;
    }).join('');

    // NPK Schedule
    document.getElementById('npkTable').innerHTML = `
        <div class="npk-row npk-header"><div class="npk-cell">প্রয়োগের সময়</div><div class="npk-cell">ইউরিয়া</div><div class="npk-cell">এমওপি</div><div class="npk-cell">জিপসাম</div></div>
        ${DOSE_SCHEDULE.map(row => `<div class="npk-row"><div class="npk-cell">${row.time}</div><div class="npk-cell">${row.urea}</div><div class="npk-cell">${row.mop}</div><div class="npk-cell">${row.gypsum}</div></div>`).join('')}`;

    // Irrigation
    const irrigData = [
        `জমি রোপণের আগে কাদা করে ৫ সেমি পানি রাখুন`,
        `রোপণের পর থেকে কুশি আসা পর্যন্ত ৫-১০ সেমি পানি রাখুন`,
        `থোড় আসার সময় জমি কখনো শুকাবেন না`,
        `ফুল ফোটার সময় ৩-৫ সেমি পানি অবশ্যই রাখুন`,
        `পাকার ২ সপ্তাহ আগে সেচ বন্ধ করুন`,
        `${selectedSoil === 'sandy' ? '⚠️ বেলে মাটিতে ঘন ঘন সেচ দিতে হবে (৩-৪ দিন পরপর)' : selectedSoil === 'clay' ? '✅ এঁটেল মাটিতে সেচের ব্যবধান বেশি রাখুন (৫-৭ দিন)' : '✅ দোআঁশ মাটিতে স্বাভাবিক সেচ দিন (৪-৫ দিন পরপর)'}`
    ];
    document.getElementById('irrigBody').innerHTML = irrigData.map(item => `<div class="irrig-item"><span>💧</span><span>${item}</span></div>`).join('');
}

// ══════════════════════════════════════════════
// ─── MARKET PRICE TRACKER ─────────────────────
// ══════════════════════════════════════════════

const MARKET_PRICES = {
    fine: [
        { district:'ঢাকা', price:1850, change:'+৩০', trend:'up' },
        { district:'চট্টগ্রাম', price:1800, change:'+১৫', trend:'up' },
        { district:'রাজশাহী', price:1780, change:'—', trend:'same' },
        { district:'খুলনা', price:1760, change:'+২০', trend:'up' },
        { district:'বরিশাল', price:1820, change:'-১০', trend:'down' },
        { district:'সিলেট', price:1870, change:'+২৫', trend:'up' },
        { district:'রংপুর', price:1750, change:'—', trend:'same' },
        { district:'ময়মনসিংহ', price:1810, change:'+১০', trend:'up' },
        { district:'কুমিল্লা', price:1790, change:'-৫', trend:'down' },
        { district:'বগুড়া', price:1760, change:'—', trend:'same' },
        { district:'দিনাজপুর', price:1740, change:'+১৫', trend:'up' },
        { district:'ফরিদপুর', price:1800, change:'+২০', trend:'up' },
    ],
    medium: [
        { district:'ঢাকা', price:1450, change:'+২০', trend:'up' },
        { district:'চট্টগ্রাম', price:1400, change:'+১০', trend:'up' },
        { district:'রাজশাহী', price:1380, change:'—', trend:'same' },
        { district:'খুলনা', price:1370, change:'+১৫', trend:'up' },
        { district:'বরিশাল', price:1420, change:'-৫', trend:'down' },
        { district:'সিলেট', price:1460, change:'+২০', trend:'up' },
        { district:'রংপুর', price:1360, change:'—', trend:'same' },
        { district:'ময়মনসিংহ', price:1410, change:'+৮', trend:'up' },
        { district:'কুমিল্লা', price:1390, change:'-১০', trend:'down' },
        { district:'বগুড়া', price:1370, change:'—', trend:'same' },
        { district:'দিনাজপুর', price:1350, change:'+১২', trend:'up' },
        { district:'ফরিদপুর', price:1400, change:'+১৮', trend:'up' },
    ],
    coarse: [
        { district:'ঢাকা', price:1150, change:'+১০', trend:'up' },
        { district:'চট্টগ্রাম', price:1120, change:'+৮', trend:'up' },
        { district:'রাজশাহী', price:1100, change:'—', trend:'same' },
        { district:'খুলনা', price:1090, change:'+১২', trend:'up' },
        { district:'বরিশাল', price:1130, change:'-৮', trend:'down' },
        { district:'সিলেট', price:1160, change:'+১৫', trend:'up' },
        { district:'রংপুর', price:1080, change:'—', trend:'same' },
        { district:'ময়মনসিংহ', price:1120, change:'+৫', trend:'up' },
        { district:'কুমিল্লা', price:1100, change:'-৫', trend:'down' },
        { district:'বগুড়া', price:1090, change:'—', trend:'same' },
        { district:'দিনাজপুর', price:1070, change:'+১০', trend:'up' },
        { district:'ফরিদপুর', price:1110, change:'+১৫', trend:'up' },
    ],
    paddy: [
        { district:'ঢাকা', price:820, change:'+১৫', trend:'up' },
        { district:'চট্টগ্রাম', price:800, change:'+১০', trend:'up' },
        { district:'রাজশাহী', price:790, change:'—', trend:'same' },
        { district:'খুলনা', price:780, change:'+১০', trend:'up' },
        { district:'বরিশাল', price:810, change:'-৫', trend:'down' },
        { district:'সিলেট', price:830, change:'+২০', trend:'up' },
        { district:'রংপুর', price:775, change:'—', trend:'same' },
        { district:'ময়মনসিংহ', price:800, change:'+৮', trend:'up' },
        { district:'কুমিল্লা', price:785, change:'-৩', trend:'down' },
        { district:'বগুড়া', price:778, change:'—', trend:'same' },
        { district:'দিনাজপুর', price:765, change:'+১২', trend:'up' },
        { district:'ফরিদপুর', price:798, change:'+১৮', trend:'up' },
    ]
};

let activePriceType = 'fine';

function renderPriceGrid(type) {
    const grid = document.getElementById('priceGrid');
    const prices = MARKET_PRICES[type];
    const now = new Date(); document.getElementById('priceUpdated').textContent = now.toLocaleDateString('bn-BD');
    grid.innerHTML = prices.map(item => {
        const arrowIcon = item.trend==='up'?'▲':item.trend==='down'?'▼':'—';
        const changeClass = item.trend==='up'?'up':item.trend==='down'?'down':'same';
        return `<div class="price-item">
            <div class="pi-district">${item.district}</div>
            <div class="pi-price">৳${toBanglaNum(item.price)}</div>
            <div class="pi-change ${changeClass}">${arrowIcon} ${item.change}</div>
        </div>`;
    }).join('');
}

document.querySelectorAll('.price-filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.price-filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active'); activePriceType = this.dataset.rice;
        renderPriceGrid(activePriceType);
    });
});

renderPriceGrid('fine');

document.getElementById('calcProfitBtn').addEventListener('click', calculateProfit);

function calculateProfit() {
    const land = parseFloat(document.getElementById('profitLand').value) || 1;
    const yieldPerAcre = parseFloat(document.getElementById('profitYield').value) || 60;
    const pricePerMon = parseFloat(document.getElementById('profitPrice').value) || 800;
    const costSeed = parseFloat(document.getElementById('costSeed').value) || 0;
    const costFert = parseFloat(document.getElementById('costFertilizer').value) || 0;
    const costIrrig = parseFloat(document.getElementById('costIrrigation').value) || 0;
    const costPest = parseFloat(document.getElementById('costPesticide').value) || 0;
    const costLabor = parseFloat(document.getElementById('costLabor').value) || 0;

    const totalYield = land * yieldPerAcre;
    const totalIncome = totalYield * pricePerMon;
    const totalCost = costSeed + costFert + costIrrig + costPest + costLabor;
    const netProfit = totalIncome - totalCost;
    const profitPerAcre = netProfit / land;

    const profitResult = document.getElementById('profitResult');
    profitResult.style.display = 'block';

    document.getElementById('psIncome').textContent = '৳' + toBanglaNum(Math.round(totalIncome).toLocaleString('en'));
    document.getElementById('psCost').textContent = '৳' + toBanglaNum(Math.round(totalCost).toLocaleString('en'));
    document.getElementById('psProfit').textContent = '৳' + toBanglaNum(Math.round(netProfit).toLocaleString('en'));
    document.getElementById('psPerAcre').textContent = '৳' + toBanglaNum(Math.round(profitPerAcre).toLocaleString('en'));

    // Bar chart
    const costs = [
        { name:'বীজ', val:costSeed, color:'#6366f1' },
        { name:'সার', val:costFert, color:'#10b981' },
        { name:'সেচ', val:costIrrig, color:'#3b82f6' },
        { name:'কীটনাশক', val:costPest, color:'#f59e0b' },
        { name:'শ্রম', val:costLabor, color:'#ef4444' }
    ].filter(c => c.val > 0);

    const totalCostChart = costs.reduce((a,b) => a+b.val, 0) || 1;
    document.getElementById('profitBarChart').innerHTML = costs.map(c => {
        const pct = Math.round((c.val/totalCostChart)*100);
        return `<div class="pbc-segment" style="flex:${pct};background:${c.color};" title="${c.name}: ${pct}%">${pct > 8 ? c.name : ''}</div>`;
    }).join('');

    // Advice
    const roi = (netProfit / totalCost) * 100;
    const adviceEl = document.getElementById('profitAdvice');
    if (netProfit > 0 && roi > 30) {
        adviceEl.className = 'profit-advice good';
        adviceEl.textContent = `✅ চমৎকার! আপনার ROI ${Math.round(roi)}%। এই মৌসুমে ভালো লাভ হবে। আগামী মৌসুমে উন্নত জাত ও সঠিক সার ব্যবস্থাপনায় আরো বেশি ফলন পাওয়া সম্ভব।`;
    } else if (netProfit > 0) {
        adviceEl.className = 'profit-advice warn';
        adviceEl.textContent = `⚠️ মুনাফা হবে তবে ROI কম (${Math.round(roi)}%)। সার ও শ্রম খরচ কমিয়ে লাভ বাড়ানোর চেষ্টা করুন। হাইব্রিড জাত ব্যবহারে ফলন বাড়তে পারে।`;
    } else {
        adviceEl.className = 'profit-advice bad';
        adviceEl.textContent = `❌ এই হিসাবে লোকসান হবে। খরচ কমানোর উপায় খুঁজুন — সরকারি ভর্তুকি সার ব্যবহার করুন, সমবায়ের মাধ্যমে কৃষি যন্ত্রপাতি ভাড়া নিন।`;
    }
}

// ══════════════════════════════════════════════
// ─── AI CHATBOT ────────────────────────────────
// ══════════════════════════════════════════════

const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const typingIndicator = document.getElementById('typingIndicator');
const chatStatus = document.getElementById('chatStatus');
let chatHistory = [];

function appendMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${isUser ? 'user-msg' : 'bot-msg'}`;
    const avatar = isUser ? '👤' : '🌾';
    msgDiv.innerHTML = `<div class="msg-avatar">${avatar}</div><div class="msg-bubble"><div class="msg-text">${text}</div></div>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    if (!isUser) {
        speakText(text);
    }
}

function showTyping() { typingIndicator.style.display = 'flex'; chatMessages.scrollTop = chatMessages.scrollHeight; }
function hideTyping() { typingIndicator.style.display = 'none'; }

async function sendMessage(userText) {
    if (!userText.trim()) return;
    appendMessage(userText, true);
    chatInput.value = '';
    sendChatBtn.disabled = true;
    chatStatus.textContent = 'AI উত্তর তৈরি করছে...';
    showTyping();

    chatHistory.push({ role: 'user', content: userText });

    const systemPrompt = `আপনি "কৃষক বন্ধু" — একজন অভিজ্ঞ বাংলাদেশি কৃষি বিশেষজ্ঞ। আপনি বাংলাদেশের কৃষকদের ধান চাষ, ফসল উৎপাদন, রোগবালাই দমন, সার ব্যবস্থাপনা, সেচ, আবহাওয়া সতর্কতা এবং বাজারদর বিষয়ে পরামর্শ দেন।

নির্দেশিকা:
- সবসময় বাংলায় উত্তর দিন
- সহজ ও সরল ভাষা ব্যবহার করুন যা সাধারণ কৃষক বুঝতে পারবেন
- বাংলাদেশের আবহাওয়া, মাটি ও স্থানীয় পরিস্থিতি মাথায় রাখুন
- বোরো, আমন, আউশ তিনটি মৌসুম সম্পর্কে জ্ঞান রাখুন
- BRRI অনুমোদিত জাত ও পদ্ধতি সুপারিশ করুন
- উত্তর সংক্ষিপ্ত কিন্তু তথ্যসমৃদ্ধ রাখুন (৩-৬ বাক্য)
- প্রয়োজনে বুলেট পয়েন্ট ব্যবহার করুন`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                system: systemPrompt,
                messages: chatHistory
            })
        });

        if (!response.ok) { throw new Error('API ত্রুটি: ' + response.status); }
        const data = await response.json();
        const botReply = data.content[0].text;
        chatHistory.push({ role: 'assistant', content: botReply });
        hideTyping();
        // Format reply: convert newlines to <br>, asterisks to bullets
        const formatted = botReply.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/^\* (.+)/gm, '• $1');
        appendMessage(formatted, false);
        chatStatus.textContent = '';
    } catch (err) {
        hideTyping();
        chatHistory.pop(); // Remove failed user message from history
        appendMessage('দুঃখিত, এই মুহূর্তে AI সংযোগ সমস্যা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন। (' + err.message + ')', false);
        chatStatus.textContent = '';
    }

    sendChatBtn.disabled = false;
}

sendChatBtn.addEventListener('click', () => sendMessage(chatInput.value));
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatInput.value); } });

// Quick question buttons
document.querySelectorAll('.qq-btn, .pq-item').forEach(btn => {
    btn.addEventListener('click', function() { sendMessage(this.dataset.q); });
});

// Welcome suggestions clickable
document.querySelector('.welcome-suggestions')?.addEventListener('click', e => {
    if (e.target.tagName === 'LI') sendMessage(e.target.textContent.trim());
});

// Limit chat history to last 10 exchanges to avoid token overflow
function trimHistory() { if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20); }
const originalSend = sendMessage;


// ══════════════════════════════════════════════
// ─── VOICE INPUT (বাংলা স্পিচ রিকগনিশন) ───────
// ══════════════════════════════════════════════

(function initVoice() {
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceStatus = document.getElementById('voiceStatus');
    const chatInputEl = document.getElementById('chatInput');

    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        voiceBtn.disabled = true;
        voiceBtn.title = 'এই ব্রাউজারে ভয়েস সমর্থিত নয়';
        voiceBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
        voiceStatus.textContent = 'ভয়েস ইনপুট সমর্থিত নয় (Chrome ব্যবহার করুন)';
        voiceStatus.className = 'voice-not-supported';
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'bn-BD';       // Bangla Bangladesh
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let isRecording = false;
    let interimTranscript = '';

    voiceBtn.addEventListener('click', () => {
        if (!isRecording) startRecording();
        else stopRecording();
    });

    function startRecording() {
        isRecording = true;
        voiceBtn.classList.add('recording');
        voiceStatus.textContent = '🎙️ বলুন... (আবার চাপলে থামবে)';
        interimTranscript = '';
        try { recognition.start(); }
        catch(e) { resetUI(); voiceStatus.textContent = 'ভয়েস শুরু করতে সমস্যা হয়েছে'; }
    }

    function stopRecording() {
        recognition.stop();
        resetUI();
    }

    function resetUI() {
        isRecording = false;
        voiceBtn.classList.remove('recording');
    }

    recognition.onresult = (event) => {
        let finalTranscript = '';
        interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) finalTranscript += t;
            else interimTranscript += t;
        }
        // Show interim as placeholder, final as value
        if (interimTranscript) {
            voiceStatus.textContent = '💬 শুনছি: ' + interimTranscript;
        }
        if (finalTranscript) {
            chatInputEl.value = (chatInputEl.value + ' ' + finalTranscript).trim();
            voiceStatus.textContent = '✅ রেকর্ড হয়েছে';
        }
    };

    recognition.onerror = (event) => {
        resetUI();
        const errorMessages = {
            'no-speech':          'কোনো কথা শোনা যায়নি। আবার চেষ্টা করুন।',
            'audio-capture':      'মাইক্রোফোন পাওয়া যাচ্ছে না।',
            'not-allowed':        'মাইক্রোফোনের অনুমতি দিন।',
            'network':            'নেটওয়ার্ক সমস্যা।',
            'language-not-supported': 'বাংলা ভয়েস সমর্থিত নয় এই ডিভাইসে।'
        };
        voiceStatus.textContent = errorMessages[event.error] || 'ভয়েস ত্রুটি: ' + event.error;
    };

    recognition.onend = () => {
        resetUI();
        if (!chatInputEl.value.trim()) {
            voiceStatus.textContent = 'কিছু শোনা যায়নি। আবার চেষ্টা করুন।';
        } else {
            setTimeout(() => { voiceStatus.textContent = ''; }, 3000);
        }
    };

    recognition.onspeechstart = () => {
        voiceStatus.textContent = '🎙️ আওয়াজ শনাক্ত হচ্ছে...';
    };
})();

(function initAccessibilityAndPWA() {
    document.querySelectorAll('.listen-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const section = this.closest('section');
            speakSection(section || document.body);
        });
    });

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW register failed:', err));
        });
    }
})();

// ══════════════════════════════════════════════
// ─── AUTH SYSTEM ──────────────────────────────
// ══════════════════════════════════════════════

(function initAuth() {
    // Simple localStorage-based auth (replace with real backend later)
    const AUTHORITY_CODE = 'KRISHOK2025'; // Change this secret code
    let currentUser = JSON.parse(localStorage.getItem('kb_user') || 'null');
    let selectedRole = 'farmer';
    let isRegisterMode = false;

    const overlay   = document.getElementById('authOverlay');
    const closeBtn  = document.getElementById('authCloseBtn');
    const signInBtn = document.getElementById('navSignInBtn');
    const navUserItem = document.getElementById('navUserItem');
    const navAuthItem = document.getElementById('navAuthItem');

    function openModal() { overlay.classList.add('open'); }
    function closeModal() { overlay.classList.remove('open'); resetForms(); }

    function resetForms() {
        document.getElementById('authFormArea').style.display = 'block';
        document.getElementById('authRegArea').style.display = 'none';
        document.getElementById('authError').style.display = 'none';
        document.getElementById('authUsername').value = '';
        document.getElementById('authPassword').value = '';
        isRegisterMode = false;
    }

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if(e.target === overlay) closeModal(); });
    signInBtn.addEventListener('click', e => { e.preventDefault(); openModal(); });

    // Role tabs
    document.querySelectorAll('.auth-role-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.auth-role-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            selectedRole = this.dataset.role;
            document.getElementById('regRoleField').style.display =
                selectedRole === 'authority' ? 'block' : 'none';
            document.getElementById('authModalSub').textContent =
                selectedRole === 'authority'
                    ? 'কর্তৃপক্ষ হিসেবে সাইন ইন করুন — বাজারদর আপডেট করুন'
                    : 'কৃষক হিসেবে সাইন ইন করুন';
        });
    });

    // Switch to register
    document.getElementById('authSwitchLink').addEventListener('click', () => {
        document.getElementById('authFormArea').style.display = 'none';
        document.getElementById('authRegArea').style.display = 'block';
        document.getElementById('regRoleField').style.display =
            selectedRole === 'authority' ? 'block' : 'none';
    });
    document.getElementById('backToLoginLink').addEventListener('click', () => {
        document.getElementById('authFormArea').style.display = 'block';
        document.getElementById('authRegArea').style.display = 'none';
    });

    // Login submit
    document.getElementById('authSubmitBtn').addEventListener('click', () => {
        const username = document.getElementById('authUsername').value.trim();
        const password = document.getElementById('authPassword').value;
        if (!username || !password) { showAuthError('সব তথ্য পূরণ করুন।'); return; }

        const users = JSON.parse(localStorage.getItem('kb_users') || '[]');
        const found = users.find(u => u.mobile === username && u.password === btoa(password) && u.role === selectedRole);
        if (!found) { showAuthError('ভুল নম্বর, পাসওয়ার্ড বা ভূমিকা।'); return; }

        loginUser(found);
    });

    // Register submit
    document.getElementById('regSubmitBtn').addEventListener('click', () => {
        const name     = document.getElementById('regName').value.trim();
        const mobile   = document.getElementById('regMobile').value.trim();
        const password = document.getElementById('regPassword').value;
        const authCode = document.getElementById('regAuthCode').value.trim();

        if (!name || !mobile || !password) { showRegError('সব তথ্য পূরণ করুন।'); return; }
        if (password.length < 6) { showRegError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে।'); return; }
        if (selectedRole === 'authority' && authCode !== AUTHORITY_CODE) {
            showRegError('কর্তৃপক্ষ কোড সঠিক নয়।'); return;
        }

        const users = JSON.parse(localStorage.getItem('kb_users') || '[]');
        if (users.find(u => u.mobile === mobile && u.role === selectedRole)) {
            showRegError('এই নম্বরে ইতিমধ্যে অ্যাকাউন্ট আছে।'); return;
        }

        const newUser = { name, mobile, password: btoa(password), role: selectedRole };
        users.push(newUser);
        localStorage.setItem('kb_users', JSON.stringify(users));
        loginUser(newUser);
    });

    function loginUser(user) {
        currentUser = user;
        localStorage.setItem('kb_user', JSON.stringify(user));
        closeModal();
        updateNavbar();
        if (user.role === 'authority') enablePriceEditing();
        showToast(`স্বাগতম, ${user.name}!`);
    }

    function logout() {
        currentUser = null;
        localStorage.removeItem('kb_user');
        updateNavbar();
        disablePriceEditing();
        showToast('সাইন আউট হয়েছে।');
    }

    function updateNavbar() {
        if (currentUser) {
            navAuthItem.style.display = 'none';
            const roleColor = currentUser.role === 'authority' ? '#1d4ed8' : '#3d8b40';
            const initials = currentUser.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
            navUserItem.style.display = 'list-item';
            navUserItem.innerHTML = `<div class="nav-user-badge">
                <div class="nav-user-avatar" style="background:${roleColor};">${initials}</div>
                <span class="nav-user-name">${currentUser.name}</span>
                ${currentUser.role === 'authority' ? '<span class="authority-badge">কর্তৃপক্ষে</span>' : ''}
                <button class="nav-logout-btn" id="logoutBtn">সাইন আউট</button>
            </div>`;
            document.getElementById('logoutBtn').addEventListener('click', logout);
        } else {
            navAuthItem.style.display = 'list-item';
            navUserItem.style.display = 'none';
        }
    }

    function showAuthError(msg) {
        const el = document.getElementById('authError');
        el.textContent = msg; el.style.display = 'block';
    }
    function showRegError(msg) {
        const el = document.getElementById('regError');
        el.textContent = msg; el.style.display = 'block';
    }

    // ── AUTHORITY: PRICE EDITING ──────────────
    function enablePriceEditing() {
        // Re-render price grid with editable inputs
        const originalRender = window._renderPriceGridOriginal || renderPriceGrid;
        window._renderPriceGridOriginal = originalRender;

        window.renderPriceGridAuthority = function(type) {
            const grid = document.getElementById('priceGrid');
            const prices = MARKET_PRICES[type];
            const saved = JSON.parse(localStorage.getItem('kb_prices_' + type) || 'null');
            const data = saved || prices;

            const now = new Date();
            document.getElementById('priceUpdated').innerHTML =
                now.toLocaleDateString('bn-BD') +
                ' <span class="authority-badge" style="font-size:10px;">সম্পাদনযোগ্য</span>';

            grid.innerHTML = data.map((item, idx) => {
                const arrowIcon = item.trend==='up'?'▲':item.trend==='down'?'▼':'—';
                const changeClass = item.trend==='up'?'up':item.trend==='down'?'down':'same';
                return `<div class="price-item">
                    <div class="pi-district">${item.district}</div>
                    <div class="price-edit-row">
                        <span style="font-size:13px;color:var(--stone);">৳</span>
                        <input class="price-edit-input" type="number" data-idx="${idx}" data-type="${type}" value="${item.price}" min="0" step="10">
                    </div>
                    <div class="pi-change ${changeClass}" style="margin-top:3px;">${arrowIcon} ${item.change}</div>
                    <button class="price-edit-save" data-idx="${idx}" data-type="${type}">সংরক্ষণ</button>
                </div>`;
            }).join('');

            grid.querySelectorAll('.price-edit-save').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idx = parseInt(this.dataset.idx);
                    const t = this.dataset.type;
                    const inp = grid.querySelector(`.price-edit-input[data-idx="${idx}"]`);
                    const newPrice = parseInt(inp.value);
                    const storedData = JSON.parse(localStorage.getItem('kb_prices_' + t) || JSON.stringify(MARKET_PRICES[t]));
                    const oldPrice = storedData[idx].price;
                    const diff = newPrice - oldPrice;
                    storedData[idx].price = newPrice;
                    storedData[idx].change = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '—';
                    storedData[idx].trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
                    localStorage.setItem('kb_prices_' + t, JSON.stringify(storedData));
                    MARKET_PRICES[t] = storedData;
                    showToast(`${storedData[idx].district}: ৳${newPrice} সংরক্ষিত হয়েছে`);
                    window.renderPriceGridAuthority(t);
                });
            });
        };

        document.querySelectorAll('.price-filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.price-filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                activePriceType = this.dataset.rice;
                window.renderPriceGridAuthority(activePriceType);
            });
        });

        window.renderPriceGridAuthority(activePriceType);
    }

    function disablePriceEditing() {
        document.querySelectorAll('.price-filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.price-filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                activePriceType = this.dataset.rice;
                renderPriceGrid(activePriceType);
            });
        });
        renderPriceGrid(activePriceType);
    }

    // ── TOAST NOTIFICATION ────────────────────
    function showToast(msg) {
        let t = document.getElementById('kb-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'kb-toast';
            t.style.cssText = `position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
                background:var(--ink);color:var(--white);padding:12px 24px;border-radius:var(--r-full);
                font-size:14px;font-weight:600;z-index:9999;box-shadow:var(--shadow-lg);
                transition:opacity 0.4s;pointer-events:none;`;
            document.body.appendChild(t);
        }
        t.textContent = msg; t.style.opacity = '1';
        setTimeout(() => { t.style.opacity = '0'; }, 2800);
    }

    ['fine','medium','coarse','paddy'].forEach(type => {
        const saved = localStorage.getItem('kb_prices_' + type);
        if (saved) MARKET_PRICES[type] = JSON.parse(saved);
    });

    updateNavbar();
    if (currentUser && currentUser.role === 'authority') enablePriceEditing();
    else renderPriceGrid(activePriceType);
})();
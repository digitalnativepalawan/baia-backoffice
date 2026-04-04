<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>BuildKit - Website Builder</title>
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #09090B; overflow-x: hidden; }
        .phone-mockup { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .slide-up { animation: slideUp 0.3s ease-out; }
        .transition-all { transition: all 0.2s ease; }
        [onclick] { cursor: pointer; }
    </style>
</head>
<body>
    <div id="root"></div>

    <script>
        // ---------- STATE MANAGEMENT ----------
        let appState = {
            name: '',
            type: '',
            templateId: 'wanderlust',
            color: '#14B8A6',
            tagline: '',
            step: 0,
            features: { contactForm: true, booking: false, gallery: true, analytics: false, darkToggle: true },
            font: 'Syne',
            buttonStyle: 'rounded'
        };
        
        let currentStep = 0;
        let showAdminSheet = false;
        let activeTab = 'preview';
        
        // Load saved state
        const savedState = localStorage.getItem('buildkit_state');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                appState = { ...appState, ...parsed };
                currentStep = appState.step;
            } catch(e) {}
        }
        
        function saveState() {
            appState.step = currentStep;
            localStorage.setItem('buildkit_state', JSON.stringify(appState));
        }
        
        function setField(field, value) {
            appState[field] = value;
            saveState();
            render();
        }
        
        function setFeatures(features) {
            appState.features = features;
            saveState();
            render();
        }
        
        function resetSite() {
            if (confirm('Reset everything? This cannot be undone.')) {
                appState = {
                    name: '', type: '', templateId: 'wanderlust', color: '#14B8A6', tagline: '', step: 0,
                    features: { contactForm: true, booking: false, gallery: true, analytics: false, darkToggle: true },
                    font: 'Syne', buttonStyle: 'rounded'
                };
                currentStep = 0;
                showAdminSheet = false;
                saveState();
                render();
            }
        }
        
        // ---------- TEMPLATE RENDERS ----------
        function renderWanderlust(name, tagline, color) {
            return `
                <div class="w-full bg-gradient-to-b from-gray-900 to-black rounded-2xl overflow-hidden">
                    <div class="h-48 bg-gradient-to-r" style="background: linear-gradient(135deg, ${color}, ${color}cc)">
                        <div class="p-6 pt-12">
                            <h2 class="text-2xl font-bold text-white mb-2">${name || 'Wanderlust Resort'}</h2>
                            <p class="text-white/80 text-sm">${tagline || 'Experience paradise like never before'}</p>
                            <button class="mt-4 px-6 py-2 bg-white text-gray-900 rounded-full text-sm font-semibold">Book Now</button>
                        </div>
                    </div>
                    <div class="p-4 space-y-3">
                        <div class="bg-gray-800 rounded-xl p-3"><h3 class="font-semibold text-white mb-1">Ocean View Suite</h3><p class="text-teal-400 text-sm">$299/night</p></div>
                        <div class="bg-gray-800 rounded-xl p-3"><h3 class="font-semibold text-white mb-1">Mountain View Room</h3><p class="text-teal-400 text-sm">$199/night</p></div>
                        <p class="text-gray-400 text-sm mt-2">Luxury amenities • Ocean views • Fine dining</p>
                    </div>
                </div>
            `;
        }
        
        function renderCarta(name, tagline, color) {
            return `
                <div class="w-full bg-gradient-to-b from-gray-900 to-black rounded-2xl overflow-hidden">
                    <div class="p-6 text-center border-b border-gray-800">
                        <h2 class="text-3xl font-bold mb-2" style="color: ${color}">${name || 'Carta'}</h2>
                        <p class="text-gray-400 text-sm">${tagline || 'Italian cuisine at its finest'}</p>
                        <div class="flex gap-3 mt-4 justify-center">
                            <button class="px-4 py-2 rounded-full text-sm font-semibold" style="background: ${color}; color: white">View Menu</button>
                            <button class="px-4 py-2 rounded-full border border-gray-700 text-white text-sm font-semibold">Reserve</button>
                        </div>
                    </div>
                    <div class="p-4 space-y-3">
                        <div class="flex justify-between items-center p-3 bg-gray-800 rounded-xl"><div><h3 class="font-semibold text-white">Truffle Pasta</h3><p class="text-gray-400 text-xs">Homemade pasta</p></div><span class="text-teal-400">$24</span></div>
                        <div class="flex justify-between items-center p-3 bg-gray-800 rounded-xl"><div><h3 class="font-semibold text-white">Grilled Salmon</h3><p class="text-gray-400 text-xs">With lemon butter</p></div><span class="text-teal-400">$32</span></div>
                        <div class="text-center text-gray-400 text-xs pt-2"><p>Mon-Sun: 11am - 11pm</p><p>123 Restaurant St</p></div>
                    </div>
                </div>
            `;
        }
        
        function renderFolio(name, tagline, color) {
            return `
                <div class="w-full bg-gradient-to-b from-gray-900 to-black rounded-2xl overflow-hidden">
                    <div class="p-6 text-center">
                        <div class="w-20 h-20 mx-auto bg-gradient-to-br rounded-full mb-3" style="background: ${color}"></div>
                        <h2 class="text-2xl font-bold text-white mb-1">${name || 'Alex Morgan'}</h2>
                        <p class="text-gray-400 text-sm">${tagline || 'Creative Director'}</p>
                        <button class="mt-4 px-6 py-2 rounded-full text-sm font-semibold" style="background: ${color}; color: white">See My Work</button>
                    </div>
                    <div class="p-4 space-y-3">
                        <div class="bg-gray-800 rounded-xl p-3"><h3 class="font-semibold text-white">Brand Identity</h3><p class="text-gray-400 text-xs">Logo design, guidelines</p></div>
                        <div class="bg-gray-800 rounded-xl p-3"><h3 class="font-semibold text-white">Web Design</h3><p class="text-gray-400 text-xs">Responsive websites</p></div>
                        <div class="flex justify-center gap-4 mt-2 text-gray-400 text-xs"><span>📧 hello@alex.com</span><span>📱 @alexmorgan</span></div>
                    </div>
                </div>
            `;
        }
        
        function renderPhoneMockup() {
            const templates = {
                wanderlust: renderWanderlust(appState.name, appState.tagline, appState.color),
                carta: renderCarta(appState.name, appState.tagline, appState.color),
                folio: renderFolio(appState.name, appState.tagline, appState.color)
            };
            return `
                <div class="w-full max-w-[280px] mx-auto bg-black rounded-3xl overflow-hidden border border-gray-800 phone-mockup">
                    <div class="bg-gray-900 p-2">
                        <div class="w-32 h-1 bg-gray-700 rounded-full mx-auto mb-2"></div>
                        <div class="bg-black rounded-2xl overflow-hidden" style="min-height: 400px">
                            ${templates[appState.templateId]}
                        </div>
                    </div>
                </div>
            `;
        }
        
        // ---------- SCREEN RENDERS ----------
        function renderStep0() {
            return `
                <div class="min-h-screen bg-[#09090B] px-4 py-8 pb-24">
                    <div class="max-w-[420px] mx-auto">
                        <div class="flex gap-2 justify-center mb-8">
                            ${[0,1,2,3].map(i => `<div class="h-1 flex-1 rounded-full ${i === 0 ? 'bg-teal-500' : 'bg-gray-800'}"></div>`).join('')}
                        </div>
                        <h1 class="text-3xl font-bold text-white mb-2 font-['Syne']">Launch your webapp in minutes</h1>
                        <p class="text-gray-400 mb-6 text-sm">Get started with BuildKit</p>
                        <input type="text" id="businessName" placeholder="Business name" value="${appState.name}" class="w-full bg-[#111113] border border-[#2A2A30] rounded-xl px-4 py-3 text-white mb-6 focus:outline-none focus:border-teal-500">
                        <div class="space-y-3 mb-8">
                            ${['6 Templates', 'Fully customizable', 'Deploy instantly'].map(text => `<div class="bg-[#111113] border border-[#2A2A30] rounded-xl p-4"><p class="text-white font-medium">${text}</p></div>`).join('')}
                        </div>
                    </div>
                    <div class="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#09090B] to-transparent">
                        <div class="max-w-[420px] mx-auto">
                            <button onclick="const name = document.getElementById('businessName').value; if(name.trim()) { setField('name', name); currentStep = 1; saveState(); render(); }" class="w-full py-3 rounded-xl font-semibold bg-teal-500 text-white">Continue</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function renderStep1() {
            const types = ['Resort/Hotel', 'Food & Drink', 'Creative Studio', 'Shop', 'Services', 'Events'];
            return `
                <div class="min-h-screen bg-[#09090B] px-4 py-8 pb-24">
                    <div class="max-w-[420px] mx-auto">
                        <button onclick="currentStep = 0; saveState(); render();" class="text-gray-400 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/></svg>
                        </button>
                        <h2 class="text-2xl font-bold text-white mb-6 font-['Syne']">What kind of business?</h2>
                        <div class="grid grid-cols-2 gap-3">
                            ${types.map(t => `
                                <div onclick="setField('type', '${t}');" class="p-4 rounded-xl border-2 cursor-pointer text-center ${appState.type === t ? 'border-teal-500 bg-teal-500/10' : 'border-[#2A2A30] bg-[#111113]'}">
                                    <div class="w-8 h-8 mx-auto mb-2 bg-gray-800 rounded-full"></div>
                                    <p class="text-sm ${appState.type === t ? 'text-teal-500' : 'text-white'}">${t}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#09090B] to-transparent">
                        <div class="max-w-[420px] mx-auto">
                            <button onclick="if(appState.type) { currentStep = 2; saveState(); render(); }" class="w-full py-3 rounded-xl font-semibold ${appState.type ? 'bg-teal-500 text-white' : 'bg-gray-800 text-gray-500'}">Choose a template</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function renderStep2() {
            const templates = [
                { id: 'wanderlust', name: 'Wanderlust', category: 'Resort', desc: 'Perfect for hotels & resorts' },
                { id: 'carta', name: 'Carta', category: 'Restaurant', desc: 'Ideal for restaurants & cafes' },
                { id: 'folio', name: 'Folio', category: 'Portfolio', desc: 'Great for creatives & freelancers' }
            ];
            return `
                <div class="min-h-screen bg-[#09090B] px-4 py-8 pb-32">
                    <div class="max-w-[420px] mx-auto">
                        <button onclick="currentStep = 1; saveState(); render();" class="text-gray-400 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/></svg>
                        </button>
                        <h2 class="text-2xl font-bold text-white mb-6 font-['Syne']">Pick your template</h2>
                        <div class="space-y-4">
                            ${templates.map(t => `
                                <div onclick="setField('templateId', '${t.id}');" class="bg-[#111113] border-2 rounded-xl p-4 cursor-pointer ${appState.templateId === t.id ? 'border-teal-500' : 'border-[#2A2A30]'}">
                                    <div class="flex items-center justify-between mb-3">
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-full bg-teal-500"></div>
                                            <div><h3 class="text-white font-semibold">${t.name}</h3><p class="text-gray-400 text-xs">${t.category}</p></div>
                                        </div>
                                        ${appState.templateId === t.id ? '<div class="text-teal-500"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg></div>' : ''}
                                    </div>
                                    <p class="text-gray-400 text-sm">${t.desc}</p>
                                    ${appState.templateId === t.id ? `<div class="mt-4">${renderPhoneMockup()}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#09090B] to-transparent">
                        <div class="max-w-[420px] mx-auto">
                            <button onclick="if(appState.templateId) { currentStep = 3; saveState(); render(); }" class="w-full py-3 rounded-xl font-semibold ${appState.templateId ? 'bg-teal-500 text-white' : 'bg-gray-800 text-gray-500'}">Customize</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function renderStep3() {
            const colors = ['#14B8A6', '#0D9488', '#F59E0B', '#8B5CF6', '#EF4444', '#3B82F6'];
            return `
                <div class="min-h-screen bg-[#09090B] px-4 py-8 pb-32">
                    <div class="max-w-[420px] mx-auto">
                        <button onclick="currentStep = 2; saveState(); render();" class="text-gray-400 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/></svg>
                        </button>
                        <h2 class="text-2xl font-bold text-white mb-6 font-['Syne']">Make it yours</h2>
                        <div class="mb-6">
                            <label class="text-gray-400 text-sm mb-2 block">Tagline</label>
                            <input type="text" id="taglineInput" value="${appState.tagline}" placeholder="Your tagline here" class="w-full bg-[#111113] border border-[#2A2A30] rounded-xl px-4 py-3 text-white">
                        </div>
                        <div class="mb-6">
                            <label class="text-gray-400 text-sm mb-2 block">Brand Color</label>
                            <div class="flex gap-3 flex-wrap">
                                ${colors.map(c => `<div onclick="setField('color', '${c}');" class="w-10 h-10 rounded-full cursor-pointer border-2 ${appState.color === c ? 'border-white' : 'border-transparent'}" style="background: ${c}"></div>`).join('')}
                            </div>
                        </div>
                        ${renderPhoneMockup()}
                    </div>
                    <div class="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#09090B] to-transparent">
                        <div class="max-w-[420px] mx-auto">
                            <button onclick="const tagline = document.getElementById('taglineInput').value; setField('tagline', tagline); currentStep = 4; saveState(); render();" class="w-full py-3 rounded-xl font-semibold bg-teal-500 text-white">Launch my site</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function renderBuilder() {
            return `
                <div class="min-h-screen bg-[#09090B] pb-16">
                    <div class="max-w-[420px] mx-auto">
                        ${activeTab === 'preview' ? `
                            <div class="p-4">
                                ${renderPhoneMockup()}
                                <div class="flex gap-3 mt-6">
                                    <button class="flex-1 py-2 bg-teal-500 text-white rounded-xl text-sm font-semibold">Share link</button>
                                    <button onclick="showAdminSheet = true; render();" class="flex-1 py-2 bg-[#111113] border border-[#2A2A30] text-white rounded-xl text-sm font-semibold">Edit in Admin</button>
                                </div>
                            </div>
                        ` : ''}
                        ${activeTab === 'pages' ? `
                            <div class="p-4 space-y-4">
                                <h3 class="text-white font-semibold mb-3">Page visibility</h3>
                                ${['Home', 'About', 'Contact', 'Gallery', 'Booking'].map(page => `
                                    <div class="flex justify-between items-center p-3 bg-[#111113] rounded-xl">
                                        <span class="text-white">${page}</span>
                                        <div class="w-10 h-5 bg-teal-500 rounded-full relative"><div class="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full"></div></div>
                                    </div>
                                `).join('')}
                                <button class="w-full py-3 bg-teal-500/10 border border-teal-500 rounded-xl text-teal-500 font-semibold">+ Add page</button>
                            </div>
                        ` : ''}
                        ${activeTab === 'design' ? `
                            <div class="p-4 space-y-6">
                                <div><label class="text-gray-400 text-sm block mb-2">Font</label><div class="flex gap-2">${['Syne', 'Jakarta', 'Inter'].map(f => `<button onclick="setField('font', '${f}');" class="flex-1 py-2 rounded-xl ${appState.font === f ? 'bg-teal-500 text-white' : 'bg-[#111113] text-gray-400'}">${f}</button>`).join('')}</div></div>
                                <div><label class="text-gray-400 text-sm block mb-2">Button Style</label><div class="flex gap-2">${['rounded', 'pill', 'sharp'].map(s => `<button onclick="setField('buttonStyle', '${s}');" class="flex-1 py-2 rounded-xl ${appState.buttonStyle === s ? 'bg-teal-500 text-white' : 'bg-[#111113] text-gray-400'}">${s}</button>`).join('')}</div></div>
                                <div><label class="text-gray-400 text-sm block mb-2">Color</label><div class="flex gap-3 flex-wrap">${['#14B8A6', '#0D9488', '#F59E0B', '#8B5CF6', '#EF4444', '#3B82F6'].map(c => `<div onclick="setField('color', '${c}');" class="w-8 h-8 rounded-full cursor-pointer border-2 ${appState.color === c ? 'border-white' : 'border-transparent'}" style="background: ${c}"></div>`).join('')}</div></div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="fixed bottom-0 left-0 right-0 bg-[#111113] border-t border-[#2A2A30] py-2">
                        <div class="max-w-[420px] mx-auto flex justify-around">
                            ${['preview', 'pages', 'design', 'admin'].map(tab => `
                                <button onclick="activeTab = '${tab}'; render();" class="flex flex-col items-center gap-1 py-2 px-4 rounded-xl ${activeTab === tab ? 'text-teal-500' : 'text-gray-500'}">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776"/></svg>
                                    <span class="text-xs capitalize">${tab}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    
                    ${showAdminSheet ? `
                        <div class="fixed inset-0 bg-black/80 z-50 flex items-end" onclick="showAdminSheet = false; render();">
                            <div class="bg-[#111113] rounded-t-3xl w-full max-w-[420px] mx-auto slide-up" onclick="event.stopPropagation()">
                                <div class="w-12 h-1 bg-gray-700 rounded-full mx-auto my-3"></div>
                                <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                                    <h3 class="text-white font-semibold">Site settings</h3>
                                    <input type="text" id="adminName" value="${appState.name}" placeholder="Site name" class="w-full bg-[#111113] border border-[#2A2A30] rounded-xl px-4 py-2 text-white">
                                    <input type="text" id="adminTagline" value="${appState.tagline}" placeholder="Tagline" class="w-full bg-[#111113] border border-[#2A2A30] rounded-xl px-4 py-2 text-white">
                                    <button onclick="setField('name', document.getElementById('adminName').value); setField('tagline', document.getElementById('adminTagline').value); currentStep = 2; saveState(); showAdminSheet = false; render();" class="w-full py-2 bg-teal-500/10 border border-teal-500 rounded-xl text-teal-500">Change template</button>
                                    <h3 class="text-white font-semibold mt-4">Features</h3>
                                    ${['contactForm', 'booking', 'gallery', 'analytics', 'darkToggle'].map(f => `
                                        <div class="flex justify-between items-center">
                                            <span class="text-gray-400">${f.replace(/([A-Z])/g, ' $1').trim()}</span>
                                            <div onclick="const newFeatures = {...appState.features, ['${f}']: !appState.features['${f}']}; setFeatures(newFeatures);" class="w-10 h-5 rounded-full relative cursor-pointer ${appState.features[f] ? 'bg-teal-500' : 'bg-gray-700'}">
                                                <div class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${appState.features[f] ? 'right-0.5' : 'left-0.5'}"></div>
                                            </div>
                                        </div>
                                    `).join('')}
                                    <button onclick="resetSite(); showAdminSheet = false;" class="w-full py-2 bg-red-500/10 border border-red-500 rounded-xl text-red-500 mt-4">Reset site</button>
                                    <div class="h-8"></div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        // ---------- MAIN RENDER FUNCTION ----------
        function render() {
            const root = document.getElementById('root');
            if (currentStep < 4) {
                if (currentStep === 0) root.innerHTML = renderStep0();
                else if (currentStep === 1) root.innerHTML = renderStep1();
                else if (currentStep === 2) root.innerHTML = renderStep2();
                else if (currentStep === 3) root.innerHTML = renderStep3();
            } else {
                root.innerHTML = renderBuilder();
            }
        }
        
        // Make functions global for onclick
        window.setField = setField;
        window.setFeatures = setFeatures;
        window.resetSite = resetSite;
        window.render = render;
        
        // Initial render
        render();
    </script>
</body>
</html>

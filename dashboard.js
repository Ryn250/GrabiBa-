APP.requireAuth(); // Ensure user is logged in

const walletBalance = document.getElementById('walletBalance');
const driverSelect = document.getElementById('driverSelect');
const bookRideBtn = document.getElementById('bookRideBtn');
const bookingMessage = document.getElementById('bookingMessage');

const pickupInput = document.getElementById('pickupAddress');
const dropoffInput = document.getElementById('dropoffAddress');

const ridesCtx = document.getElementById('ridesChart').getContext('2d');
const driverCtx = document.getElementById('driverChart').getContext('2d');

let ridesChart = null;
let driverChart = null;

// Weather container
const weatherContainer = document.createElement('div');
weatherContainer.style.margin = '10px 0';
weatherContainer.id = 'weatherInfo';
document.querySelector('.container').prepend(weatherContainer);

// Update wallet balance
function updateWallet() {
    walletBalance.textContent = APP.getWallet().balance.toFixed(2);
}

// Populate drivers dropdown
function populateDrivers() {
    driverSelect.innerHTML = '';
    APP.drivers.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `${d.name} — ${d.rating.toFixed(1)}★ — ${d.busy ? 'Busy ❌' : 'Available ✅'}`;
        if(d.busy) opt.disabled = true;
        driverSelect.appendChild(opt);
    });
    if(driverSelect.options.length === 0){
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = 'No drivers available';
        driverSelect.appendChild(opt);
    }
}

// Load ride history chart
function loadRideHistoryChart() {
    const rides = APP.getRides();
    const labels = rides.map(r => new Date(r.createdAt).toLocaleString()).slice(0, 10).reverse();
    const data = rides.map(r => r.fare).slice(0, 10).reverse();

    if(ridesChart) ridesChart.destroy();
    ridesChart = new Chart(ridesCtx, {
        type: 'bar',
        data: { labels, datasets: [{ label:'Fare (₱)', data, backgroundColor:'rgba(0, 194, 110, 0.6)', borderColor:'rgba(0,194,110,1)', borderWidth:1 }] },
        options: { responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });
}

// Load driver ratings chart
function loadDriverChart() {
    const labels = APP.drivers.map(d => d.name);
    const data = APP.drivers.map(d => d.rating);

    if(driverChart) driverChart.destroy();
    driverChart = new Chart(driverCtx, {
        type: 'bar',
        data: { labels, datasets:[{label:'Rating', data, backgroundColor:'rgba(0,194,110,0.6)', borderColor:'rgba(0,194,110,1)', borderWidth:1}] },
        options: { responsive:true, scales:{y:{min:0,max:5}} }
    });
}

// Convert simple address to pseudo coordinates (for demo purposes)
function addressToCoords(address) {
    let hash = 0;
    for(let i=0;i<address.length;i++){ hash += address.charCodeAt(i); }
    const lat = 8.3664 + (hash % 100) * 0.0001;
    const lng = 124.8648 + (hash % 100) * 0.0001;
    return { lat, lng };
}

// Book ride
bookRideBtn.addEventListener('click', () => {
    const pickupAddr = pickupInput.value.trim();
    const dropoffAddr = dropoffInput.value.trim();

    if(!pickupAddr || !dropoffAddr){
        bookingMessage.textContent = 'Please enter both pickup and dropoff addresses.';
        return;
    }

    const pickup = addressToCoords(pickupAddr);
    const dropoff = addressToCoords(dropoffAddr);
    const selectedDriverId = driverSelect.value || null;

    const result = APP.bookRide({ pickup, dropoff, selectedDriverId });

    if(result.success){
        bookingMessage.innerHTML = `
            Ride booked!<br>
            Fare: ₱${result.fare.toFixed(2)}<br>
            Pickup: ${pickupAddr}<br>
            Dropoff: ${dropoffAddr}
        `;
        updateWallet();
        populateDrivers();
        setTimeout(()=>{
            loadRideHistoryChart();
            loadDriverChart();
            populateDrivers();
        },1500);
    } else {
        bookingMessage.textContent = result.message;
    }
});

// Weather API Integration
async function loadWeather() {
    try {
        // Replace with user's location or fixed coordinates
        const lat = 8.3664;
        const lon = 124.8648;
        const apiKey = '7ff2ba59c54d89e95381d189eb463bea'; // Your API key
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

        const res = await fetch(url);
        const data = await res.json();

        const temp = data.main.temp.toFixed(1);
        const description = data.weather[0].description;
        const icon = `http://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;

        weatherContainer.innerHTML = `
            <h3>Today's Weather</h3>
            <img src="${icon}" alt="Weather Icon" style="width:50px; vertical-align:middle;">
            <span style="font-size:16px; margin-left:10px;">${description}, ${temp}°C</span>
        `;
    } catch(e){
        weatherContainer.textContent = 'Unable to load weather data.';
        console.error(e);
    }
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', ()=>{
    APP.logout();
    window.location.href='login.html';
});

// Initialize dashboard
function initDashboard(){
    APP.createDrivers();
    updateWallet();
    populateDrivers();
    loadRideHistoryChart();
    loadDriverChart();
    loadWeather();
}

initDashboard();

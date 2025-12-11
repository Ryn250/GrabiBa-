/* app.js - app brain: auth, drivers, wallet, rides, simulation */

/* Single global APP object */
const APP = {
  /* ---------- AUTH ---------- */
  isLoggedIn(){
    return !!localStorage.getItem('grabi_token');
  },

  register(username, password, extra={dob:'', location:''}){
    if(!username || !password) return false;
    const users = JSON.parse(localStorage.getItem('grabi_users') || '{}');
    if(users[username]) return false;
    users[username] = { username, password, created: Date.now(), dob: extra.dob, location: extra.location };
    localStorage.setItem('grabi_users', JSON.stringify(users));
    return true;
  },

  login(username, password){
    const users = JSON.parse(localStorage.getItem('grabi_users') || '{}');
    if(!users[username]) return false;
    if(users[username].password !== password) return false;
    const token = 'token_' + Math.random().toString(36).slice(2,10);
    const user = { username, token, created: Date.now(), dob: users[username].dob, location: users[username].location };
    localStorage.setItem('grabi_token', token);
    localStorage.setItem('grabi_user', JSON.stringify(user));
    return true;
  },

  logout(){
    localStorage.removeItem('grabi_token');
    localStorage.removeItem('grabi_user');
  },

  requireAuth(redirectTo='login.html'){ if(!APP.isLoggedIn()) window.location.href = redirectTo; },

  getUser(){ return JSON.parse(localStorage.getItem('grabi_user') || 'null'); },

  /* ---------- WALLET ---------- */
  getWallet(){
    const wallets = JSON.parse(localStorage.getItem('grabi_wallet') || '{}');
    const user = APP.getUser();
    if(!user) return { balance: 0 };
    return wallets[user.username] || { balance: 150.00 };
  },

  saveWallet(w){
    const wallets = JSON.parse(localStorage.getItem('grabi_wallet') || '{}');
    const user = APP.getUser();
    wallets[user.username] = w;
    localStorage.setItem('grabi_wallet', JSON.stringify(wallets));
  },

  addFunds(amount){
    const w = APP.getWallet();
    w.balance = +(w.balance + amount).toFixed(2);
    APP.saveWallet(w);
  },

  deductFare(amount){
    const w = APP.getWallet();
    w.balance = +(w.balance - amount).toFixed(2);
    APP.saveWallet(w);
  },

  /* ---------- SUPPORT ---------- */
  getSupport(){ const all = JSON.parse(localStorage.getItem('grabi_support') || '[]'); const u = APP.getUser(); return all.filter(x=> x.username === u.username); },
  addSupport(msg){ const all = JSON.parse(localStorage.getItem('grabi_support') || '[]'); all.unshift({...msg, username: APP.getUser().username}); localStorage.setItem('grabi_support', JSON.stringify(all)); },

  /* ---------- RIDE HISTORY ---------- */
  getRides(){
    const all = JSON.parse(localStorage.getItem('grabi_rides') || '[]');
    const user = APP.getUser();
    return all.filter(r => r.username === user.username);
  },

  addRide(ride){
    const all = JSON.parse(localStorage.getItem('grabi_rides') || '[]');
    all.unshift({...ride, username: APP.getUser().username});
    localStorage.setItem('grabi_rides', JSON.stringify(all));
  },

  updateRide(updated){
    const all = JSON.parse(localStorage.getItem('grabi_rides') || '[]');
    const idx = all.findIndex(r => r.id === updated.id && r.username === APP.getUser().username);
    if(idx !== -1){ all[idx] = {...updated, username: APP.getUser().username}; localStorage.setItem('grabi_rides', JSON.stringify(all)); }
  },

  /* ---------- DRIVERS ---------- */
  drivers: [],

  createDrivers(count = 6){
    const saved = JSON.parse(localStorage.getItem('grabi_drivers') || 'null');
    if(saved && Array.isArray(saved) && saved.length) { APP.drivers = saved; return; }
    APP.drivers = [];
    for(let i=0;i<count;i++){
      APP.drivers.push({
        id: 'D'+(1000+i),
        name: 'Driver '+(i+1),
        lat: 8.3664 + (Math.random()-0.5)*0.02,
        lng: 124.8648 + (Math.random()-0.5)*0.02,
        plate: 'HAB-'+Math.floor(1000 + Math.random()*9000),
        rating: +(3 + Math.random()*2).toFixed(1),
        ratingCount: Math.floor(5 + Math.random()*40),
        busy: false
      });
    }
    localStorage.setItem('grabi_drivers', JSON.stringify(APP.drivers));
  },

  saveDrivers(){ localStorage.setItem('grabi_drivers', JSON.stringify(APP.drivers)); },
  getDriverById(id){ return APP.drivers.find(d=> d.id === id) || null; },

  getNearestDriver(pickup){
    let nearest = null, best = Infinity;
    APP.drivers.forEach(d=>{
      if(d.busy) return;
      const dx = d.lat - pickup.lat;
      const dy = d.lng - pickup.lng;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if(dist < best){ best = dist; nearest = d; }
    });
    return nearest;
  },

  calculateFare(distanceKm){
    const base = 20; const perKm = 8;
    return +(base + distanceKm*perKm).toFixed(2);
  },

  getDistanceKm(a,b){
    const R = 6371;
    const dLat = (b.lat - a.lat)*Math.PI/180;
    const dLng = (b.lng - a.lng)*Math.PI/180;
    const lat1 = a.lat*Math.PI/180, lat2 = b.lat*Math.PI/180;
    const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
    return R*2*Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  },

  bookRide({ pickup, dropoff, selectedDriverId=null }){
    let driver = selectedDriverId ? APP.getDriverById(selectedDriverId) : APP.getNearestDriver(pickup);
    if(!driver || driver.busy) return { success:false, message:'Driver unavailable' };

    const distanceKm = APP.getDistanceKm(pickup, dropoff);
    const fare = APP.calculateFare(distanceKm);

    const wallet = APP.getWallet();
    if(wallet.balance < fare) return { success:false, message:'Insufficient wallet balance' };
    APP.deductFare(fare);

    driver.busy = true; APP.saveDrivers();

    const ride = {
      id: 'R' + Date.now().toString(36),
      driverId: driver.id,
      driverName: driver.name,
      driverPlate: driver.plate,
      driverRatingBefore: driver.rating,
      pickup, dropoff, distanceKm, fare,
      status: 'pending',
      createdAt: new Date().toISOString(),
      startAt: null, endAt: null, userRating: null
    };

    APP.addRide(ride);
    APP._simulateRideFlow(ride, driver);

    return { success:true, rideId: ride.id, fare };
  },

  _simulateRideFlow(ride, driver){
    setTimeout(()=>{
      ride.status = 'accepted'; APP.updateRide(ride);
      ride.status = 'picking_up'; APP.updateRide(ride);

      APP._moveDriver(driver, ride.pickup, ()=>{
        ride.status = 'ongoing'; ride.startAt = new Date().toISOString(); APP.updateRide(ride);

        APP._moveDriver(driver, ride.dropoff, ()=>{
          ride.status = 'completed'; ride.endAt = new Date().toISOString();
          driver.busy = false; APP.saveDrivers();
          APP.updateRide(ride);
          localStorage.setItem('grabi_pending_rating', JSON.stringify({
            rideId: ride.id, driverId: driver.id, driverName: driver.name, driverPlate: driver.plate
          }));
        });
      });
    }, 900);
  },

  _moveDriver(driver, target, cb){
    const step = ()=>{
      const dx = target.lat - driver.lat;
      const dy = target.lng - driver.lng;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if(dist < 0.0006){ driver.lat = target.lat; driver.lng = target.lng; APP.saveDrivers(); if(cb) cb(); return; }
      driver.lat += dx * 0.06; driver.lng += dy * 0.06; APP.saveDrivers();
      setTimeout(step, 120);
    }; step();
  },

  applyUserRating(driverId, userRating){
    const driver = APP.getDriverById(driverId);
    if(!driver) return false;
    const prevTotal = driver.rating * (driver.ratingCount || 0);
    const newCount = (driver.ratingCount || 0) + 1;
    driver.rating = +((prevTotal + userRating) / newCount).toFixed(1);
    driver.ratingCount = newCount;
    APP.saveDrivers();
    return true;
  },

  /* ---------- FORM ABSTRACTION ---------- */
  form: {
    login(userId, passId, callback){
      const username = document.getElementById(userId).value;
      const password = document.getElementById(passId).value;
      const success = APP.login(username, password);
      if(callback) callback(success);
      return success;
    },

    register(userId, passId, dobId, locId, callback){
      const username = document.getElementById(userId).value;
      const password = document.getElementById(passId).value;
      const dob = document.getElementById(dobId).value;
      const location = document.getElementById(locId).value;
      const success = APP.register(username, password, {dob, location});
      if(callback) callback(success);
      return success;
    }
  },

  init(){
    APP.createDrivers();
    window.addEventListener('storage', e=>{
      if(e.key === 'grabi_drivers') APP.drivers = JSON.parse(e.newValue || '[]');
    });
  }
};

APP.init();

// Data pengguna (dalam aplikasi nyata, ini akan diambil dari backend)
const users = [
    { id: 1, username: "user1", password: "pass123", name: "Budi Santoso", job: "Software Developer" },
    { id: 2, username: "user2", password: "pass123", name: "Siti Nurhaliza", job: "UI/UX Designer" },
    { id: 3, username: "user3", password: "pass123", name: "Agus Priyanto", job: "Project Manager" },
    { id: 4, username: "admin", password: "admin123", name: "Admin System", job: "Administrator", role: "admin" }
];

// Data absensi (disimpan di localStorage)
let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let currentPhoto = null;
let currentLocation = null;

// Login Page Logic
if (document.getElementById('loginBtn')) {
    const loginBtn = document.getElementById('loginBtn');
    
    loginBtn.addEventListener('click', function() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;
        
        console.log('Login attempt:', { username, password, role });
        
        // Validasi input
        if (!username || !password) {
            alert('Username dan password harus diisi!');
            return;
        }
        
        // Cari user
        const user = users.find(u => u.username === username && u.password === password);
        
        if (!user) {
            alert('Username atau password salah!');
            return;
        }
        
        // Periksa role untuk admin
        if (role === 'admin') {
            if (user.username !== 'admin') {
                alert('Hanya user admin yang bisa login sebagai admin!');
                return;
            }
        }
        
        console.log('User found:', user);
        
        // Simpan user yang login
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        console.log('User saved to localStorage');
        
        // Redirect berdasarkan role
        if (role === 'admin') {
            console.log('Redirecting to admin.html');
            window.location.href = 'admin.html';
        } else {
            console.log('Redirecting to dashboard.html');
            window.location.href = 'dashboard.html';
        }
    });
    
    // Tambahkan juga event listener untuk tombol Enter
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && document.getElementById('loginBtn')) {
            document.getElementById('loginBtn').click();
        }
    });
}

// Dashboard Page Logic - PERBAIKAN: Tambah cek untuk redirect jika tidak login
if (document.getElementById('userName')) {
    // Inisialisasi dashboard
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Dashboard loaded, checking user...');
        console.log('Current user from localStorage:', currentUser);
        
        // Redirect ke login jika tidak ada user yang login
        if (!currentUser) {
            console.log('No user found, redirecting to login...');
            alert('Silakan login terlebih dahulu!');
            window.location.href = 'index.html';
            return;
        }
        
        console.log('User authenticated:', currentUser.name);
        
        // Tampilkan info user
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userJob').textContent = currentUser.job;
        document.getElementById('profileName').textContent = currentUser.name;
        document.getElementById('profileJob').textContent = currentUser.job;
        document.getElementById('profileId').textContent = `ID: ${currentUser.id}`;
        
        // Update waktu real-time
        updateDateTime();
        setInterval(updateDateTime, 1000);
        
        // Inisialisasi kamera
        initCamera();
        
        // Dapatkan lokasi
        getLocation();
        
        // Update status absensi
        updateAttendanceStatus();
        
        // Tampilkan riwayat
        displayAttendanceHistory();
        
        // Setup event listeners
        setupEventListeners();
    });
}

// Admin Page Logic - PERBAIKAN: Tambah cek untuk redirect jika bukan admin
if (document.getElementById('adminLogoutBtn')) {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Admin page loaded, checking user...');
        
        // Ambil user dari localStorage
        const storedUser = JSON.parse(localStorage.getItem('currentUser'));
        console.log('Stored user:', storedUser);
        
        // Redirect ke login jika tidak ada user yang login atau bukan admin
        if (!storedUser || storedUser.username !== 'admin') {
            console.log('User not admin or not logged in, redirecting...');
            alert('Akses ditolak! Halaman ini hanya untuk admin.');
            window.location.href = 'index.html';
            return;
        }
        
        console.log('Admin authenticated:', storedUser.name);
        
        // Load data
        loadAttendanceData();
        loadEmployeeData();
        updateStatistics();
        
        // Setup event listeners
        setupAdminEventListeners();
        
        // Setup modal
        setupModal();
    });
}

// Fungsi untuk format tanggal
function formatDate(date = new Date()) {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayName}, ${day} ${month} ${year}`;
}

// Fungsi untuk format waktu
function formatTime(date = new Date()) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
}

// Fungsi untuk mendapatkan tanggal dalam format YYYY-MM-DD
function getDateString(date = new Date()) {
    return date.toISOString().split('T')[0];
}

// Dashboard Page Functions
function updateDateTime() {
    const now = new Date();
    if (document.getElementById('currentTime')) {
        document.getElementById('currentTime').textContent = formatTime(now);
        document.getElementById('currentDate').textContent = formatDate(now);
    }
}

function initCamera() {
    const video = document.getElementById('cameraPreview');
    if (!video) return;
    
    const constraints = {
        video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
        }
    };
    
    // Akses kamera
    navigator.mediaDevices.getUserMedia(constraints)
        .then(function(stream) {
            video.srcObject = stream;
        })
        .catch(function(err) {
            console.error("Error mengakses kamera: ", err);
            if (document.getElementById('cameraPreview')) {
                document.getElementById('cameraPreview').style.display = 'none';
                document.querySelector('.camera-container').innerHTML = 
                    '<p style="color: white; text-align: center; padding-top: 130px;">Kamera tidak tersedia. Silakan gunakan upload foto manual.</p>';
            }
        });
}

function getLocation() {
    if (!navigator.geolocation) {
        if (document.getElementById('locationInfo')) {
            document.getElementById('locationInfo').innerHTML = 
                '<p>Geolocation tidak didukung oleh browser ini.</p>';
        }
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            currentLocation = {
                latitude: lat,
                longitude: lon,
                address: `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`
            };
            
            if (document.getElementById('locationDetails')) {
                document.getElementById('locationDetails').textContent = 
                    `Lokasi berhasil dideteksi`;
                document.getElementById('locationCoordinates').textContent = 
                    `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
            }
            
            // Reverse geocoding sederhana (simulasi)
            setTimeout(() => {
                const addresses = [
                    "Kantor Pusat, Jl. Sudirman No. 123, Jakarta",
                    "Kantor Cabang, Jl. Thamrin No. 45, Jakarta",
                    "Kantor Operasional, Jl. Gatot Subroto No. 67, Jakarta"
                ];
                const randomAddress = addresses[Math.floor(Math.random() * addresses.length)];
                currentLocation.address = randomAddress;
                if (document.getElementById('locationDetails')) {
                    document.getElementById('locationDetails').textContent = randomAddress;
                }
            }, 1000);
        },
        function(error) {
            console.error("Error mendapatkan lokasi: ", error);
            if (document.getElementById('locationInfo')) {
                document.getElementById('locationInfo').innerHTML = 
                    '<p>Lokasi tidak dapat diakses. Pastikan izin lokasi diaktifkan.</p>';
            }
            
            // Lokasi default jika gagal
            currentLocation = {
                latitude: -6.2088,
                longitude: 106.8456,
                address: "Jakarta, Indonesia (lokasi default)"
            };
        }
    );
}

function updateAttendanceStatus() {
    if (!currentUser) return;
    
    const today = getDateString();
    const todayAttendance = attendanceData.filter(record => 
        record.userId === currentUser.id && record.date === today
    );
    
    let hasCheckedIn = false;
    let hasCheckedOut = false;
    
    if (todayAttendance.length > 0) {
        const checkInRecord = todayAttendance.find(record => record.type === 'masuk');
        const checkOutRecord = todayAttendance.find(record => record.type === 'pulang');
        
        if (checkInRecord) {
            hasCheckedIn = true;
            document.getElementById('masukInfo').innerHTML = `
                <p>Status: <span class="status done">Sudah Absen</span></p>
                <p>Waktu: ${checkInRecord.time}</p>
            `;
            document.getElementById('absenMasukBtn').disabled = true;
        }
        
        if (checkOutRecord) {
            hasCheckedOut = true;
            document.getElementById('pulangInfo').innerHTML = `
                <p>Status: <span class="status done">Sudah Absen</span></p>
                <p>Waktu: ${checkOutRecord.time}</p>
            `;
            document.getElementById('absenPulangBtn').disabled = true;
        }
    }
    
    // Enable tombol absen pulang jika sudah absen masuk
    if (hasCheckedIn && !hasCheckedOut) {
        document.getElementById('absenPulangBtn').disabled = false;
    }
    
    // Hitung statistik
    calculateStatistics();
}

function calculateStatistics() {
    if (!currentUser) return;
    
    const userAttendance = attendanceData.filter(record => record.userId === currentUser.id);
    const totalHadir = new Set(userAttendance.map(record => record.date)).size;
    
    // Hitung terlambat (absen masuk setelah jam 9:00)
    const totalTerlambat = userAttendance.filter(record => 
        record.type === 'masuk' && 
        parseInt(record.time.split(':')[0]) >= 9
    ).length;
    
    // Simulasikan data izin
    const totalIzin = Math.floor(Math.random() * 3);
    
    if (document.getElementById('totalHadir')) {
        document.getElementById('totalHadir').textContent = totalHadir;
        document.getElementById('totalTerlambat').textContent = totalTerlambat;
        document.getElementById('totalIzin').textContent = totalIzin;
    }
}

function displayAttendanceHistory() {
    if (!currentUser) return;
    
    const historyTable = document.getElementById('attendanceHistory');
    if (!historyTable) return;
    
    const tableBody = historyTable.getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';
    
    // Ambil data 7 hari terakhir
    const today = new Date();
    const last7Days = [];
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        last7Days.push(getDateString(date));
    }
    
    // Filter data absensi untuk user ini dalam 7 hari terakhir
    const userAttendance = attendanceData.filter(record => 
        record.userId === currentUser.id && last7Days.includes(record.date)
    );
    
    // Tampilkan data
    last7Days.forEach(date => {
        const dateObj = new Date(date);
        const dayAttendance = userAttendance.filter(record => record.date === date);
        
        const checkIn = dayAttendance.find(record => record.type === 'masuk');
        const checkOut = dayAttendance.find(record => record.type === 'pulang');
        
        // Tentukan status
        let status = 'Tidak Absen';
        let statusClass = 'pending';
        
        if (checkIn && checkOut) {
            status = 'Hadir';
            statusClass = 'done';
        } else if (checkIn) {
            // Cek apakah terlambat
            const checkInHour = parseInt(checkIn.time.split(':')[0]);
            status = checkInHour >= 9 ? 'Terlambat' : 'Hadir (tanpa pulang)';
            statusClass = checkInHour >= 9 ? 'late' : 'done';
        }
        
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${formatDate(dateObj)}</td>
            <td>${checkIn ? checkIn.time : '-'}</td>
            <td>${checkOut ? checkOut.time : '-'}</td>
            <td><span class="status ${statusClass}">${status}</span></td>
            <td>${checkIn ? (checkIn.location ? checkIn.location.address.substring(0, 20) + '...' : '-') : '-'}</td>
        `;
    });
}

function setupEventListeners() {
    // Tombol logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        });
    }
    
    // Tombol ambil foto
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
        captureBtn.addEventListener('click', capturePhoto);
    }
    
    // Tombol absen masuk
    const absenMasukBtn = document.getElementById('absenMasukBtn');
    if (absenMasukBtn) {
        absenMasukBtn.addEventListener('click', function() {
            if (!currentPhoto) {
                alert('Harap ambil foto terlebih dahulu!');
                return;
            }
            
            checkIn();
        });
    }
    
    // Tombol absen pulang
    const absenPulangBtn = document.getElementById('absenPulangBtn');
    if (absenPulangBtn) {
        absenPulangBtn.addEventListener('click', function() {
            if (!currentPhoto) {
                alert('Harap ambil foto terlebih dahulu!');
                return;
            }
            
            checkOut();
        });
    }
}

function capturePhoto() {
    const video = document.getElementById('cameraPreview');
    const canvas = document.getElementById('photoCanvas');
    const photoPreview = document.getElementById('photoPreview');
    
    if (!video || !canvas || !photoPreview) return;
    
    // Atur ukuran canvas sesuai video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Gambar frame video ke canvas
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Konversi ke data URL
    const photoData = canvas.toDataURL('image/jpeg');
    currentPhoto = photoData;
    
    // Tampilkan preview
    photoPreview.src = photoData;
    
    // Tampilkan notifikasi
    alert('Foto berhasil diambil!');
}

function checkIn() {
    if (!currentUser) return;
    
    const now = new Date();
    const currentTime = formatTime(now);
    const today = getDateString(now);
    
    // Cek apakah sudah absen hari ini
    const alreadyCheckedIn = attendanceData.some(record => 
        record.userId === currentUser.id && 
        record.date === today && 
        record.type === 'masuk'
    );
    
    if (alreadyCheckedIn) {
        alert('Anda sudah absen masuk hari ini!');
        return;
    }
    
    // Buat record absensi
    const attendanceRecord = {
        id: Date.now(),
        userId: currentUser.id,
        userName: currentUser.name,
        userJob: currentUser.job,
        date: today,
        time: currentTime,
        type: 'masuk',
        photo: currentPhoto,
        location: currentLocation,
        status: parseInt(currentTime.split(':')[0]) >= 9 ? 'terlambat' : 'hadir'
    };
    
    // Tambahkan ke data
    attendanceData.push(attendanceRecord);
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    
    // Update UI
    updateAttendanceStatus();
    displayAttendanceHistory();
    
    // Reset foto
    currentPhoto = null;
    document.getElementById('photoPreview').src = '';
    
    alert(`Absen masuk berhasil pada pukul ${currentTime}`);
}

function checkOut() {
    if (!currentUser) return;
    
    const now = new Date();
    const currentTime = formatTime(now);
    const today = getDateString(now);
    
    // Cek apakah sudah absen masuk
    const hasCheckedIn = attendanceData.some(record => 
        record.userId === currentUser.id && 
        record.date === today && 
        record.type === 'masuk'
    );
    
    if (!hasCheckedIn) {
        alert('Anda belum absen masuk hari ini!');
        return;
    }
    
    // Cek apakah sudah absen pulang
    const alreadyCheckedOut = attendanceData.some(record => 
        record.userId === currentUser.id && 
        record.date === today && 
        record.type === 'pulang'
    );
    
    if (alreadyCheckedOut) {
        alert('Anda sudah absen pulang hari ini!');
        return;
    }
    
    // Buat record absensi
    const attendanceRecord = {
        id: Date.now(),
        userId: currentUser.id,
        userName: currentUser.name,
        userJob: currentUser.job,
        date: today,
        time: currentTime,
        type: 'pulang',
        photo: currentPhoto,
        location: currentLocation,
        status: 'hadir'
    };
    
    // Tambahkan ke data
    attendanceData.push(attendanceRecord);
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    
    // Update UI
    updateAttendanceStatus();
    displayAttendanceHistory();
    
    // Reset foto
    currentPhoto = null;
    document.getElementById('photoPreview').src = '';
    
    alert(`Absen pulang berhasil pada pukul ${currentTime}`);
}

// Admin Page Functions (tetap di script.js karena dipanggil dari admin.html)
function setupAdminEventListeners() {
    // Tombol logout
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', function() {
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        });
    }
    
    // Tombol filter
    const applyFilterBtn = document.getElementById('applyFilter');
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', loadAttendanceData);
    }
    
    const resetFilterBtn = document.getElementById('resetFilter');
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', function() {
            document.getElementById('filterDate').value = '';
            document.getElementById('filterEmployee').value = 'all';
            document.getElementById('filterStatus').value = 'all';
            loadAttendanceData();
        });
    }
    
    // Event delegation untuk tombol lihat foto dan hapus
    document.addEventListener('click', function(e) {
        // Tombol lihat foto
        if (e.target.classList.contains('btn-view-photo')) {
            const recordId = parseInt(e.target.getAttribute('data-id'));
            viewPhoto(recordId);
        }
        
        // Tombol hapus
        if (e.target.classList.contains('btn-delete')) {
            const recordId = parseInt(e.target.getAttribute('data-id'));
            if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
                deleteRecord(recordId);
            }
        }
        
        // Tombol detail karyawan
        if (e.target.classList.contains('btn-view-details')) {
            const userId = parseInt(e.target.getAttribute('data-id'));
            viewEmployeeDetails(userId);
        }
    });
}

function setupModal() {
    const modal = document.getElementById('photoModal');
    const closeBtn = document.querySelector('.close-modal');
    
    if (!modal || !closeBtn) return;
    
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function loadAttendanceData() {
    const attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || [];
    const table = document.getElementById('attendanceData');
    if (!table) return;
    
    const tableBody = table.getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';
    
    // Filter data jika ada filter yang aktif
    const filterDate = document.getElementById('filterDate')?.value || '';
    const filterEmployee = document.getElementById('filterEmployee')?.value || 'all';
    const filterStatus = document.getElementById('filterStatus')?.value || 'all';
    
    let filteredData = attendanceData;
    
    if (filterDate) {
        filteredData = filteredData.filter(record => record.date === filterDate);
    }
    
    if (filterEmployee !== 'all') {
        filteredData = filteredData.filter(record => record.userId === parseInt(filterEmployee));
    }
    
    if (filterStatus !== 'all') {
        filteredData = filteredData.filter(record => record.status === filterStatus);
    }
    
    // Tampilkan data
    filteredData.forEach((record, index) => {
        const row = tableBody.insertRow();
        
        // Format tanggal
        const dateObj = new Date(record.date);
        const formattedDate = dateObj.toLocaleDateString('id-ID', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${record.userName}</td>
            <td>${record.userJob}</td>
            <td>${formattedDate}</td>
            <td>${record.type === 'masuk' ? record.time : '-'}</td>
            <td>${record.type === 'pulang' ? record.time : '-'}</td>
            <td><span class="status ${record.status === 'terlambat' ? 'late' : 'done'}">${record.status === 'terlambat' ? 'Terlambat' : 'Hadir'}</span></td>
            <td>${record.location ? record.location.address.substring(0, 20) + '...' : '-'}</td>
            <td><button class="btn-view-photo" data-id="${record.id}">Lihat Foto</button></td>
            <td>
                <button class="btn-delete" data-id="${record.id}">Hapus</button>
            </td>
        `;
    });
    
    // Update dropdown karyawan
    updateEmployeeFilter();
}

function loadEmployeeData() {
    const attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || [];
    const users = [
        { id: 1, username: "user1", name: "Budi Santoso", job: "Software Developer" },
        { id: 2, username: "user2", name: "Siti Nurhaliza", job: "UI/UX Designer" },
        { id: 3, username: "user3", name: "Agus Priyanto", job: "Project Manager" }
    ];
    
    const table = document.getElementById('employeeData');
    if (!table) return;
    
    const tableBody = table.getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';
    
    users.forEach(user => {
        // Hitung statistik karyawan
        const userAttendance = attendanceData.filter(record => record.userId === user.id);
        const totalHadir = new Set(userAttendance.map(record => record.date)).size;
        
        const totalTerlambat = userAttendance.filter(record => 
            record.type === 'masuk' && record.status === 'terlambat'
        ).length;
        
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.job}</td>
            <td>${user.username}</td>
            <td>${totalHadir}</td>
            <td>${totalTerlambat}</td>
            <td>
                <button class="btn-view-details" data-id="${user.id}">Detail</button>
            </td>
        `;
    });
    
    const totalEmployeesEl = document.getElementById('totalEmployees');
    if (totalEmployeesEl) {
        totalEmployeesEl.textContent = users.length;
    }
}

function updateStatistics() {
    const attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || [];
    const today = new Date().toISOString().split('T')[0];
    
    // Data hari ini
    const todayData = attendanceData.filter(record => record.date === today);
    
    // Total hadir hari ini (setiap karyawan dihitung sekali)
    const uniqueEmployeesToday = new Set(todayData.filter(record => record.type === 'masuk').map(record => record.userId));
    
    const totalPresentTodayEl = document.getElementById('totalPresentToday');
    if (totalPresentTodayEl) {
        totalPresentTodayEl.textContent = uniqueEmployeesToday.size;
    }
    
    // Total terlambat hari ini
    const totalLateToday = todayData.filter(record => record.status === 'terlambat').length;
    const totalLateTodayEl = document.getElementById('totalLateToday');
    if (totalLateTodayEl) {
        totalLateTodayEl.textContent = totalLateToday;
    }
    
    // Total karyawan belum absen (asumsi ada 3 karyawan)
    const totalNotPresentEl = document.getElementById('totalNotPresent');
    if (totalNotPresentEl) {
        totalNotPresentEl.textContent = 3 - uniqueEmployeesToday.size;
    }
}

function updateEmployeeFilter() {
    const users = [
        { id: 1, name: "Budi Santoso" },
        { id: 2, name: "Siti Nurhaliza" },
        { id: 3, name: "Agus Priyanto" }
    ];
    
    const filterSelect = document.getElementById('filterEmployee');
    if (!filterSelect) return;
    
    filterSelect.innerHTML = '<option value="all">Semua Karyawan</option>';
    
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        filterSelect.appendChild(option);
    });
}

function viewPhoto(recordId) {
    const attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || [];
    const record = attendanceData.find(r => r.id === recordId);
    
    if (!record) {
        alert('Data tidak ditemukan!');
        return;
    }
    
    // Tampilkan modal
    const modal = document.getElementById('photoModal');
    const modalPhoto = document.getElementById('modalPhoto');
    const modalName = document.getElementById('modalName');
    const modalDate = document.getElementById('modalDate');
    const modalTime = document.getElementById('modalTime');
    const modalType = document.getElementById('modalType');
    
    if (!modal || !modalPhoto || !modalName || !modalDate || !modalTime || !modalType) return;
    
    modalPhoto.src = record.photo || 'https://via.placeholder.com/400x300?text=Tidak+Ada+Foto';
    modalName.textContent = record.userName;
    
    // Format tanggal
    const dateObj = new Date(record.date);
    const formattedDate = dateObj.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    modalDate.textContent = formattedDate;
    modalTime.textContent = record.time;
    modalType.textContent = record.type === 'masuk' ? 'Absen Masuk' : 'Absen Pulang';
    
    modal.style.display = 'flex';
}

function deleteRecord(recordId) {
    let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || [];
    attendanceData = attendanceData.filter(record => record.id !== recordId);
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    
    loadAttendanceData();
    updateStatistics();
    alert('Data berhasil dihapus!');
}

function viewEmployeeDetails(userId) {
    const users = [
        { id: 1, username: "user1", name: "Budi Santoso", job: "Software Developer", email: "budi@company.com", joinDate: "2022-01-15" },
        { id: 2, username: "user2", name: "Siti Nurhaliza", job: "UI/UX Designer", email: "siti@company.com", joinDate: "2022-03-20" },
        { id: 3, username: "user3", name: "Agus Priyanto", job: "Project Manager", email: "agus@company.com", joinDate: "2021-11-10" }
    ];
    
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        alert('Data karyawan tidak ditemukan!');
        return;
    }
    
    // Tampilkan detail karyawan
    const attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || [];
    const userAttendance = attendanceData.filter(record => record.userId === userId);
    
    const totalHadir = new Set(userAttendance.map(record => record.date)).size;
    const totalTerlambat = userAttendance.filter(record => record.status === 'terlambat').length;
    
    // Format tanggal bergabung
    const joinDateObj = new Date(user.joinDate);
    const formattedJoinDate = joinDateObj.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    alert(`
        Detail Karyawan:
        
        Nama: ${user.name}
        Posisi: ${user.job}
        Email: ${user.email}
        Tanggal Bergabung: ${formattedJoinDate}
        
        Statistik:
        - Total Hadir: ${totalHadir} hari
        - Total Terlambat: ${totalTerlambat} kali
        - Username: ${user.username}
    `);
}

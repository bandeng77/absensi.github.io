// Admin Page Logic
if (document.getElementById('adminLogoutBtn')) {
    document.addEventListener('DOMContentLoaded', function() {
        // Redirect ke login jika bukan admin
        const currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
        if (!currentUser || currentUser.username !== 'admin') {
            window.location.href = 'index.html';
            return;
        }
        
        // Load data
        loadAttendanceData();
        loadEmployeeData();
        updateStatistics();
        
        // Setup event listeners
        setupAdminEventListeners();
        
        // Setup modal
        setupModal();
    });
    
    // Fungsi untuk memuat data absensi
    function loadAttendanceData() {
        const attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || [];
        const tableBody = document.getElementById('attendanceData').getElementsByTagName('tbody')[0];
        tableBody.innerHTML = '';
        
        // Filter data jika ada filter yang aktif
        const filterDate = document.getElementById('filterDate').value;
        const filterEmployee = document.getElementById('filterEmployee').value;
        const filterStatus = document.getElementById('filterStatus').value;
        
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
    
    // Fungsi untuk memuat data karyawan
    function loadEmployeeData() {
        const attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || [];
        const users = [
            { id: 1, username: "user1", name: "Budi Santoso", job: "Software Developer" },
            { id: 2, username: "user2", name: "Siti Nurhaliza", job: "UI/UX Designer" },
            { id: 3, username: "user3", name: "Agus Priyanto", job: "Project Manager" }
        ];
        
        const tableBody = document.getElementById('employeeData').getElementsByTagName('tbody')[0];
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
        
        document.getElementById('totalEmployees').textContent = users.length;
    }
    
    // Fungsi untuk update statistik
    function updateStatistics() {
        const attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || [];
        const today = new Date().toISOString().split('T')[0];
        
        // Data hari ini
        const todayData = attendanceData.filter(record => record.date === today);
        
        // Total hadir hari ini (setiap karyawan dihitung sekali)
        const uniqueEmployeesToday = new Set(todayData.filter(record => record.type === 'masuk').map(record => record.userId));
        document.getElementById('totalPresentToday').textContent = uniqueEmployeesToday.size;
        
        // Total terlambat hari ini
        const totalLateToday = todayData.filter(record => record.status === 'terlambat').length;
        document.getElementById('totalLateToday').textContent = totalLateToday;
        
        // Total karyawan belum absen (asumsi ada 3 karyawan)
        document.getElementById('totalNotPresent').textContent = 3 - uniqueEmployeesToday.size;
    }
    
    // Fungsi untuk update filter karyawan
    function updateEmployeeFilter() {
        const users = [
            { id: 1, name: "Budi Santoso" },
            { id: 2, name: "Siti Nurhaliza" },
            { id: 3, name: "Agus Priyanto" }
        ];
        
        const filterSelect = document.getElementById('filterEmployee');
        filterSelect.innerHTML = '<option value="all">Semua Karyawan</option>';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name;
            filterSelect.appendChild(option);
        });
    }
    
    // Fungsi untuk setup event listeners admin
    function setupAdminEventListeners() {
        // Tombol logout
        document.getElementById('adminLogoutBtn').addEventListener('click', function() {
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        });
        
        // Tombol filter
        document.getElementById('applyFilter').addEventListener('click', loadAttendanceData);
        document.getElementById('resetFilter').addEventListener('click', function() {
            document.getElementById('filterDate').value = '';
            document.getElementById('filterEmployee').value = 'all';
            document.getElementById('filterStatus').value = 'all';
            loadAttendanceData();
        });
        
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
    
    // Fungsi untuk setup modal
    function setupModal() {
        const modal = document.getElementById('photoModal');
        const closeBtn = document.querySelector('.close-modal');
        
        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
        
        window.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    // Fungsi untuk melihat foto
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
    
    // Fungsi untuk menghapus record
    function deleteRecord(recordId) {
        let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || [];
        attendanceData = attendanceData.filter(record => record.id !== recordId);
        localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
        
        loadAttendanceData();
        updateStatistics();
        alert('Data berhasil dihapus!');
    }
    
    // Fungsi untuk melihat detail karyawan
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
}
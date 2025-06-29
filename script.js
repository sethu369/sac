document.addEventListener('DOMContentLoaded', function() {
    // Current date and calendar state
    let currentDate = new Date();
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();
    let selectedDate = new Date();
    
    // Attendance data structure
    let attendanceData = {
        semesters: {
            1: { workingDays: [], holidays: [], attended: [], holidayNames: {}, startDate: null, endDate: null },
            2: { workingDays: [], holidays: [], attended: [], holidayNames: {}, startDate: null, endDate: null },
            3: { workingDays: [], holidays: [], attended: [], holidayNames: {}, startDate: null, endDate: null },
            4: { workingDays: [], holidays: [], attended: [], holidayNames: {}, startDate: null, endDate: null },
            5: { workingDays: [], holidays: [], attended: [], holidayNames: {}, startDate: null, endDate: null },
            6: { workingDays: [], holidays: [], attended: [], holidayNames: {}, startDate: null, endDate: null },
            7: { workingDays: [], holidays: [], attended: [], holidayNames: {}, startDate: null, endDate: null },
            8: { workingDays: [], holidays: [], attended: [], holidayNames: {}, startDate: null, endDate: null }
        },
        settings: {
            darkMode: 'light',
            absentPenalty: 0,
            lastSelectedSem: null
        },
        staticHolidays: [
             { name: "New Year's Day", date: "01-01" },
             { name: "Republic Day", date: "01-26" },
             { name: "Ambedkar Jayanti", date: "04-14" },
             { name: "Independence Day", date: "08-15" },
             { name: "Gandhi Jayanti", date: "10-02" },
             { name: "Christmas Day", date: "12-25" }
                ],
        dynamicHolidays: [
             { name: "Vinayaka Chavithi", date: "2025-02-04" },
             { name: "Radha Saptami", date: "2025-02-04" },
             { name: "Maha Shivaratri", date: "2025-02-26" },
             { name: "Holi", date: "2025-03-14" },
             { name: "Sri Rama Navami", date: "2025-04-06" },
             { name: "Good Friday", date: "2025-04-18" },
             { name: "Bakrid (Eid al-Adha)", date: "2025-06-07" },
             { name: "Varalakshmi Vratam", date: "2025-08-08" },
             { name: "Krishna Janmashtami", date: "2025-08-16" },
             { name: "Teachers' Day", date: "2025-09-05" },
             { name: "Milad-un-Nabi", date: "2025-09-05" },
             { name: "Vijayadashami", date: "2025-10-02" },
             { name: "Diwali", date: "2025-10-20" }
        ],
        bulkHolidays: [
             { name: "Sankranti", startDate: "2025-01-13", endDate: "2025-01-15" }
        ]
    };
    
    // DOM Elements
    const homePage = document.getElementById('home-page');
    const settingsPage = document.getElementById('settings-page');
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearDisplay = document.getElementById('month-year');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    const settingsBtn = document.getElementById('settings-btn');
    const backBtn = document.getElementById('back-btn');
    const darkModeSelect = document.getElementById('dark-mode-select');
    const absentPenaltyInput = document.getElementById('absent-penalty');
    const semesterSelect = document.getElementById('semester');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const setWorkingDaysBtn = document.getElementById('set-working-days');
    const workingDayCheckbox = document.getElementById('working-day');
    const collegeLeaveCheckbox = document.getElementById('college-leave');
    const wentToCollegeCheckbox = document.getElementById('went-to-college');
    const todayDateDisplay = document.getElementById('today-date');
    const addHolidayBtn = document.getElementById('add-holiday-btn');
    const holidayNameInput = document.getElementById('holiday-name');
    const holidayStartInput = document.getElementById('holiday-start');
    const holidayEndInput = document.getElementById('holiday-end');
    const bulkHolidayNameInput = document.getElementById('bulk-holiday-name');
    const addBulkHolidayBtn = document.getElementById('add-bulk-holiday');
    
    // Settings page elements
    const showStaticHolidaysBtn = document.getElementById('show-static-holidays');
    const showDynamicHolidaysBtn = document.getElementById('show-dynamic-holidays');
    const showBulkHolidaysBtn = document.getElementById('show-bulk-holidays');
    const staticHolidaysList = document.getElementById('static-holidays-list');
    const dynamicHolidaysList = document.getElementById('dynamic-holidays-list');
    const bulkHolidaysList = document.getElementById('bulk-holidays-list');
    const staticHolidaysUl = document.getElementById('static-holidays');
    const dynamicHolidaysUl = document.getElementById('dynamic-holidays');
    const bulkHolidaysUl = document.getElementById('bulk-holidays');
    const newStaticHolidayName = document.getElementById('new-static-holiday-name');
    const newStaticHolidayDate = document.getElementById('new-static-holiday-date');
    const addStaticHolidayBtn = document.getElementById('add-static-holiday');
    const newDynamicHolidayName = document.getElementById('new-dynamic-holiday-name');
    const newDynamicHolidayDate = document.getElementById('new-dynamic-holiday-date');
    const addDynamicHolidayBtn = document.getElementById('add-dynamic-holiday');
    const newBulkHolidayName = document.getElementById('new-bulk-holiday-name');
    const newBulkHolidayStart = document.getElementById('new-bulk-holiday-start');
    const newBulkHolidayEnd = document.getElementById('new-bulk-holiday-end');
    const addBulkHolidaySettingsBtn = document.getElementById('add-bulk-holiday-settings');

    // Utility Functions
    function formatDate(date) {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();
        
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;
        
        return [year, month, day].join('-');
    }

   
    function addHolidayNameDisplay(element, name) {
        // Remove existing if any
        const existing = element.querySelector('.holiday-name-display');
        if (existing) existing.remove();
        
        const display = document.createElement('span');
        display.className = 'holiday-name-display';
        display.textContent = name;
        element.appendChild(display);
    }

    function setupHoldToContinueButtons() {
        let holdInterval;
        
        function startHold(button, direction) {
            holdInterval = setInterval(() => {
                if (direction === 'prev') {
                    currentMonth--;
                    if (currentMonth < 0) {
                        currentMonth = 11;
                        currentYear--;
                    }
                } else {
                    currentMonth++;
                    if (currentMonth > 11) {
                        currentMonth = 0;
                        currentYear++;
                    }
                }
                renderCalendar(currentMonth, currentYear);
            }, 200);
        }
        
        function stopHold() {
            clearInterval(holdInterval);
        }
        
        prevMonthBtn.addEventListener('mousedown', () => startHold(prevMonthBtn, 'prev'));
        nextMonthBtn.addEventListener('mousedown', () => startHold(nextMonthBtn, 'next'));
        prevMonthBtn.addEventListener('touchstart', () => startHold(prevMonthBtn, 'prev'));
        nextMonthBtn.addEventListener('touchstart', () => startHold(nextMonthBtn, 'next'));
        
        [prevMonthBtn, nextMonthBtn].forEach(btn => {
            btn.addEventListener('mouseup', stopHold);
            btn.addEventListener('mouseleave', stopHold);
            btn.addEventListener('touchend', stopHold);
        });
    }
    // Add this with your other utility functions
function updateHolidayNameDisplay(date) {
    const holidayDisplay = document.getElementById('holiday-name-display');
    let names = [];

    // Add "Sunday" if it's Sunday
    if (date.getDay() === 0) names.push('Sunday');

    // Prepare date strings
    const dateString = formatDate(date);
    const monthDayStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const currentSem = semesterSelect.value;

    // Semester holidays
    if (currentSem) {
        const semData = attendanceData.semesters[currentSem];
        if (semData.holidays.includes(dateString)) {
            names.push(semData.holidayNames[dateString] || 'College Holiday');
        }
    }

    // Static holidays
    const staticHoliday = attendanceData.staticHolidays.find(h => h.date === monthDayStr);
    if (staticHoliday) names.push(staticHoliday.name);

    // Dynamic holidays
    const dynamicHoliday = attendanceData.dynamicHolidays.find(h => h.date === dateString);
    if (dynamicHoliday) names.push(dynamicHoliday.name);

    // Bulk holidays
    const bulkHoliday = attendanceData.bulkHolidays.find(h => {
        const start = new Date(h.startDate);
        const end = new Date(h.endDate);
        const current = new Date(dateString);
        return current >= start && current <= end;
    });
    if (bulkHoliday) names.push(bulkHoliday.name);

    // Display names, joined by comma
    holidayDisplay.textContent = names.join(', ');
    holidayDisplay.style.display = holidayDisplay.textContent ? 'inline-block' : 'none';
}
    // Initialize the app
    function init() {
        loadData();
        
        // Set last selected semester if available
        if (attendanceData.settings.lastSelectedSem) {
            semesterSelect.value = attendanceData.settings.lastSelectedSem;
        }
        
        updateTodayDisplay();
        renderCalendar(currentMonth, currentYear);
        setupEventListeners();
        updateStatusDisplay();
        renderStaticHolidays();
        renderDynamicHolidays();
        renderBulkHolidays();
        setupHoldToContinueButtons();
        
        // Set current date as default for holiday inputs
        const todayStr = formatDate(currentDate);
        // Only set default if still empty after loading
        if (holidayStartInput.value === null || holidayStartInput.value === undefined) holidayStartInput.value = todayStr;
if (holidayEndInput.value === null || holidayEndInput.value === undefined) holidayEndInput.value = todayStr;
        newDynamicHolidayDate.value = todayStr;
        newBulkHolidayStart.value = todayStr;
        newBulkHolidayEnd.value = todayStr;
        
        // Update working days if semester has start date
        const currentSem = semesterSelect.value;
        if (currentSem) {
            const semData = attendanceData.semesters[currentSem];
            if (semData.startDate) {
                startDateInput.value = semData.startDate;
                // If end date not set, set to today
                if (!semData.endDate) {
                    semData.endDate = formatDate(currentDate);
                    endDateInput.value = semData.endDate;
                    updateWorkingDays(currentSem);
                } else {
                    endDateInput.value = semData.endDate;
                }
            }
        }
    }
    
    // Load data from localStorage
    function loadData() {
        const savedData = localStorage.getItem('attendanceData');
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            attendanceData = {
                ...attendanceData,
                ...parsedData,
                // Ensure all semesters exist
                semesters: {
                    ...attendanceData.semesters,
                    ...parsedData.semesters
                }
            };
                if ('lastHolidayStart' in attendanceData && attendanceData.lastHolidayStart !== null) {
    holidayStartInput.value = attendanceData.lastHolidayStart;
}
if ('lastHolidayEnd' in attendanceData && attendanceData.lastHolidayEnd !== null) {
    holidayEndInput.value = attendanceData.lastHolidayEnd;
}
            // Set UI elements from loaded data
            darkModeSelect.value = attendanceData.settings.darkMode || 'system';
            absentPenaltyInput.value = attendanceData.settings.absentPenalty || 2;
            applyDarkMode();
        }
    }
    
    // Save data to localStorage
    function saveData() {
       attendanceData.lastHolidayStart = holidayStartInput.value || null;
attendanceData.lastHolidayEnd = holidayEndInput.value || null;
        localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
        
    }
    
    // Update working days based on start and end date
    function updateWorkingDays(sem) {
        const semData = attendanceData.semesters[sem];
        const startDate = new Date(semData.startDate);
        const endDate = new Date(semData.endDate);
        
        if (isNaN(startDate.getTime())) return;
        
        // If end date not provided, use today
        const effectiveEndDate = isNaN(endDate.getTime()) ? new Date() : endDate;
        
        // Clear existing working days in this semester
        semData.workingDays = [];
        
        // Add all dates in range (excluding Sundays)
        // ...existing code...
       // Add all dates in range (excluding Sundays and holidays)
        const currentDate = new Date(startDate);
        while (currentDate <= effectiveEndDate) {
            const dateString = formatDate(currentDate);
            // Only add as working day if not a holiday
            if (
                currentDate.getDay() !== 0 && // Not Sunday
                !semData.holidays.includes(dateString)
            ) {
                if (!semData.workingDays.includes(dateString)) {
                    semData.workingDays.push(dateString);
                }
            } else {
                // If it's a holiday, ensure it's not in workingDays
                semData.workingDays = semData.workingDays.filter(d => d !== dateString);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        saveData();
    }
    
   function updateTodayDisplay() {
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const todayStr = selectedDate.toLocaleDateString('en-GB', options);
    document.getElementById('today-date').textContent = `Today ${todayStr}`;
    
    // Update holiday name display
    updateHolidayNameDisplay(selectedDate);
}
    
    // Render the calendar for a specific month and year
    function renderCalendar(month, year) {
        // Clear previous calendar
        calendarGrid.innerHTML = '';
        
        // Set month and year display
        const monthNames = ["January", "February", "March", "April", "May", "June", 
                           "July", "August", "September", "October", "November", "December"];
        monthYearDisplay.textContent = `${monthNames[month]} ${year}`;
        
        // Get first day of month and total days in month
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Add day headers
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        dayNames.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < firstDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day empty';
            calendarGrid.appendChild(emptyDay);
        }
        
        // Add days of the month
        const currentSem = semesterSelect.value;
        const semData = currentSem ? attendanceData.semesters[currentSem] : { 
            workingDays: [], holidays: [], attended: [], holidayNames: {}, startDate: null, endDate: null 
        };
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateString = formatDate(date);
            const monthDayStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            dayElement.dataset.date = dateString;
            dayElement.style.position = 'relative';
            
            // Check if Sunday
            if (date.getDay() === 0) {
                dayElement.classList.add('sunday');
            }
            
             
            
            // Check if static holiday
            const isStaticHoliday = attendanceData.staticHolidays.some(h => h.date === monthDayStr);
            if (isStaticHoliday) {
                dayElement.classList.add('holiday');
            }
            
            // Check if dynamic holiday
            const isDynamicHoliday = attendanceData.dynamicHolidays.some(h => h.date === dateString);
            if (isDynamicHoliday) {
                dayElement.classList.add('holiday');
            }
            
            // Check if bulk holiday
            const isBulkHoliday = attendanceData.bulkHolidays.some(h => {
                const start = new Date(h.startDate);
                const end = new Date(h.endDate);
                const current = new Date(dateString);
                return current >= start && current <= end;
            });
            if (isBulkHoliday) {
                dayElement.classList.add('holiday');
            }
            
            // Check if semester holiday
            if (semData.holidays.includes(dateString)) {
                dayElement.classList.add('holiday');
            }
            
         
            // Check if the date is any kind of holiday
            const isHoliday =
                semData.holidays.includes(dateString) ||
                attendanceData.staticHolidays.some(h => h.date === monthDayStr) ||
                attendanceData.dynamicHolidays.some(h => h.date === dateString) ||
                attendanceData.bulkHolidays.some(h => {
                    const start = new Date(h.startDate);
                    const end = new Date(h.endDate);
                    const current = new Date(dateString);
                    return current >= start && current <= end;
                });

            if (!isHoliday && semData.workingDays.includes(dateString)) {
                dayElement.classList.add('working-day');

                // Check attendance status (only for past dates)
                if (date < new Date()) {
                    if (semData.attended.includes(dateString)) {
                        dayElement.classList.add('attended');
                    } else if (isWorkingDay(date)) {
                        dayElement.classList.add('absent');
                    }
                }
            }
            // ...existing code...
            
            // Highlight today
            if (day === currentDate.getDate() && month === currentDate.getMonth() && year === currentDate.getFullYear()) {
                dayElement.style.border = '2px solid var(--primary-color)';
            }
            
            // Highlight selected date
            if (day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear()) {
                dayElement.style.backgroundColor = 'var(--primary-color)';
                dayElement.style.color = 'white';
            }
            
            dayElement.addEventListener('click', (e) => {
                handleDayClick(date);
                e.stopPropagation(); // Prevent event bubbling
            });
            calendarGrid.appendChild(dayElement);
        }
    }
    
   function handleDayClick(date) {
    selectedDate = date;
    updateTodayDisplay(); // This will now update both date and holiday name
    
    const currentSem = semesterSelect.value;
    if (!currentSem) return;
    
    const semData = attendanceData.semesters[currentSem];
    const dateString = formatDate(date);
    
    // Update checkboxes
   // ...existing code...
    // Check if the date is any kind of holiday
    const monthDayStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const isStaticHoliday = attendanceData.staticHolidays.some(h => h.date === monthDayStr);
    const isDynamicHoliday = attendanceData.dynamicHolidays.some(h => h.date === dateString);
    const isBulkHoliday = attendanceData.bulkHolidays.some(h => {
        const start = new Date(h.startDate);
        const end = new Date(h.endDate);
        const current = new Date(dateString);
        return current >= start && current <= end;
    });
    const isSemesterHoliday = semData.holidays.includes(dateString);

    if (isStaticHoliday || isDynamicHoliday || isBulkHoliday || isSemesterHoliday) {
        // If any holiday, uncheck all
        workingDayCheckbox.checked = false;
        collegeLeaveCheckbox.checked = false;
        wentToCollegeCheckbox.checked = false;
    } else {
        workingDayCheckbox.checked = semData.workingDays.includes(dateString);
        collegeLeaveCheckbox.checked = false;
        wentToCollegeCheckbox.checked = semData.attended.includes(dateString);
    }
    // ...existing code...
        
        renderCalendar(currentMonth, currentYear);
    }
    
    // Check if a date is a working day (not Sunday and not holiday)
    function isWorkingDay(date) {
        const currentSem = semesterSelect.value;
        if (!currentSem) return false;
        
        const semData = attendanceData.semesters[currentSem];
        const dateString = formatDate(date);
        const monthDayStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        // Check if it's a holiday (static, dynamic, bulk, or semester-specific)
        const isHoliday = 
            semData.holidays.includes(dateString) || 
            attendanceData.staticHolidays.some(h => h.date === monthDayStr) ||
            attendanceData.dynamicHolidays.some(h => h.date === dateString) ||
            attendanceData.bulkHolidays.some(h => {
                const start = new Date(h.startDate);
                const end = new Date(h.endDate);
                const current = new Date(dateString);
                return current >= start && current <= end;
            });
        
        return date.getDay() !== 0 && 
               !isHoliday && 
               semData.workingDays.includes(dateString);
    }
    
    // Update the status display
    function updateStatusDisplay() {
        const currentSem = semesterSelect.value;
        if (!currentSem) {
            document.getElementById('attendance-display').textContent = `0D/0WD`;
            document.getElementById('percentage-display').textContent = `0.00%/100%`;
            return;
        }
        
        const semData = attendanceData.semesters[currentSem];
        
        // Calculate working days (excluding holidays and Sundays)
        const workingDays = semData.workingDays.filter(dateStr => {
            const date = new Date(dateStr);
            const monthDayStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            
            // Check if it's a holiday (static, dynamic, bulk, or semester-specific)
            const isHoliday = 
                semData.holidays.includes(dateStr) || 
                attendanceData.staticHolidays.some(h => h.date === monthDayStr) ||
                attendanceData.dynamicHolidays.some(h => h.date === dateStr) ||
                attendanceData.bulkHolidays.some(h => {
                    const start = new Date(h.startDate);
                    const end = new Date(h.endDate);
                    const current = new Date(dateStr);
                    return current >= start && current <= end;
                });
            
            return date.getDay() !== 0 && !isHoliday;
        }).length;
        
        const attendedDays = semData.attended.length;
        let percentage = workingDays > 0 ? (attendedDays / workingDays) * 100 : 0;
        percentage = Math.round(percentage * 100) / 100; // Round to 2 decimal places
        
        // Apply absent penalty if needed
        const absentDays = workingDays - attendedDays;
        if (absentDays > 0) {
            const penalty = attendanceData.settings.absentPenalty;
            percentage = Math.max(0, percentage - (absentDays * penalty));
        }
        
        // Update main display
        document.getElementById('attendance-display').textContent = `${attendedDays}D/${workingDays}WD`;
        document.getElementById('percentage-display').textContent = `${percentage.toFixed(2)}%/100%`;
        
        // Update modal display
        document.getElementById('total-working-days').textContent = workingDays;
        document.getElementById('total-holidays').textContent = semData.holidays.length + 
            attendanceData.staticHolidays.length + 
            attendanceData.dynamicHolidays.length + 
            attendanceData.bulkHolidays.reduce((sum, h) => {
                const start = new Date(h.startDate);
                const end = new Date(h.endDate);
                return sum + Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
            }, 0);
        document.getElementById('total-attended').textContent = attendedDays;
        document.getElementById('modal-attendance').textContent = `${attendedDays}D/${workingDays}WD`;
        document.getElementById('modal-percentage').textContent = `${percentage.toFixed(2)}%/100%`;
    }
    
    // Apply dark mode based on settings
    function applyDarkMode() {
        const mode = attendanceData.settings.darkMode;
        
        if (mode === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.toggle('dark-mode', prefersDark);
        } else {
            document.body.classList.toggle('dark-mode', mode === 'dark');
        }
    }
    
    // Render static holidays list
    function renderStaticHolidays() {
        staticHolidaysUl.innerHTML = '';
        attendanceData.staticHolidays.forEach((holiday, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                ${holiday.name} - ${holiday.date}
                <span class="delete-holiday" data-index="${index}">✕</span>
            `;
            staticHolidaysUl.appendChild(li);
        });
    }
    
    // Render dynamic holidays list
    function renderDynamicHolidays() {
        dynamicHolidaysUl.innerHTML = '';
        attendanceData.dynamicHolidays.forEach((holiday, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                ${holiday.name} - ${holiday.date}
                <span class="delete-holiday" data-index="${index}">✕</span>
            `;
            dynamicHolidaysUl.appendChild(li);
        });
    }
    
    // Render bulk holidays list
    function renderBulkHolidays() {
        bulkHolidaysUl.innerHTML = '';
        attendanceData.bulkHolidays.forEach((holiday, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                ${holiday.name} - ${holiday.startDate} to ${holiday.endDate}
                <span class="delete-holiday" data-index="${index}">✕</span>
            `;
            bulkHolidaysUl.appendChild(li);
        });
    }
    
    // Setup event listeners
    function setupEventListeners() {
        // Month navigation
        prevMonthBtn.addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            renderCalendar(currentMonth, currentYear);
        });
        
        nextMonthBtn.addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            renderCalendar(currentMonth, currentYear);
        });
        
        // Page navigation
        settingsBtn.addEventListener('click', () => {
            homePage.style.display = 'none';
            settingsPage.style.display = 'block';
            updateStatusDisplay();
        });
        
        backBtn.addEventListener('click', () => {
            homePage.style.display = 'block';
            settingsPage.style.display = 'none';
        });
        
        // Settings changes
        darkModeSelect.addEventListener('change', () => {
            attendanceData.settings.darkMode = darkModeSelect.value;
            applyDarkMode();
            saveData();
        });
        
        absentPenaltyInput.addEventListener('change', () => {
            attendanceData.settings.absentPenalty = parseInt(absentPenaltyInput.value);
            saveData();
            updateStatusDisplay();
        });
        
        // Semester change
        semesterSelect.addEventListener('change', () => {
            const currentSem = semesterSelect.value;
            attendanceData.settings.lastSelectedSem = currentSem;
            
            if (currentSem) {
                const semData = attendanceData.semesters[currentSem];
                if (semData.startDate) {
                    startDateInput.value = semData.startDate;
                    // If end date not set, set to today
                    if (!semData.endDate) {
                        semData.endDate = formatDate(currentDate);
                        endDateInput.value = semData.endDate;
                        updateWorkingDays(currentSem);
                    } else {
                        endDateInput.value = semData.endDate;
                    }
                }
            }
            
            saveData();
            renderCalendar(currentMonth, currentYear);
            updateStatusDisplay();
        });
        
       // ...existing code...

// Working day checkbox
workingDayCheckbox.addEventListener('change', () => {
    const currentSem = semesterSelect.value;
    if (!currentSem) {
        alert('Please select a semester first');
        workingDayCheckbox.checked = false;
        return;
    }

    const semData = attendanceData.semesters[currentSem];
    const dateString = formatDate(selectedDate);

    if (workingDayCheckbox.checked) {
        // Uncheck college leave if working day is checked
        collegeLeaveCheckbox.checked = false;
        // Add to working days
        if (!semData.workingDays.includes(dateString)) {
            semData.workingDays.push(dateString);
        }
    } else {
        // Remove from working days
        semData.workingDays = semData.workingDays.filter(d => d !== dateString);
        // Also remove from attended if no longer a working day
        semData.attended = semData.attended.filter(d => d !== dateString);
        wentToCollegeCheckbox.checked = false;
    }

    // Remove from holidays if working day is checked
    if (workingDayCheckbox.checked) {
        semData.holidays = semData.holidays.filter(d => d !== dateString);
    }

    saveData();
    renderCalendar(currentMonth, currentYear);
    updateStatusDisplay();
});

// College leave checkbox
collegeLeaveCheckbox.addEventListener('change', () => {
    const currentSem = semesterSelect.value;
    if (!currentSem) {
        alert('Please select a semester first');
        collegeLeaveCheckbox.checked = false;
        return;
    }

    const semData = attendanceData.semesters[currentSem];
    const dateString = formatDate(selectedDate);

    if (collegeLeaveCheckbox.checked) {
        // Uncheck working day and went to college if college leave is checked
        workingDayCheckbox.checked = false;
        wentToCollegeCheckbox.checked = false;
        // Add to holidays
        if (!semData.holidays.includes(dateString)) {
            semData.holidays.push(dateString);
        }
        // Remove from working days and attended
        semData.workingDays = semData.workingDays.filter(d => d !== dateString);
        semData.attended = semData.attended.filter(d => d !== dateString);
    } else {
        // Remove from holidays
        semData.holidays = semData.holidays.filter(d => d !== dateString);
    }

    saveData();
    renderCalendar(currentMonth, currentYear);
    updateStatusDisplay();
});

// Went to college checkbox
wentToCollegeCheckbox.addEventListener('change', () => {
    const currentSem = semesterSelect.value;
    if (!currentSem) {
        alert('Please select a semester first');
        wentToCollegeCheckbox.checked = false;
        return;
    }

    const semData = attendanceData.semesters[currentSem];
    const dateString = formatDate(selectedDate);

    if (wentToCollegeCheckbox.checked) {
        // Auto-check working day, uncheck college leave
        workingDayCheckbox.checked = true;
        collegeLeaveCheckbox.checked = false;
        // Add to attended
        if (!semData.attended.includes(dateString)) {
            semData.attended.push(dateString);
        }
        // Add to working days if not already
        if (!semData.workingDays.includes(dateString)) {
            semData.workingDays.push(dateString);
        }
        // Remove from holidays
        semData.holidays = semData.holidays.filter(d => d !== dateString);
    } else {
        // Remove from attended
        semData.attended = semData.attended.filter(d => d !== dateString);
    }

    saveData();
    renderCalendar(currentMonth, currentYear);
    updateStatusDisplay();
});
        
        // Add holiday button
        addHolidayBtn.addEventListener('click', () => {
            const currentSem = semesterSelect.value;
            if (!currentSem) {
                alert('Please select a semester first');
                return;
            }
            
            const holidayName = holidayNameInput.value.trim();
            if (!holidayName) {
                alert('Please enter a holiday name');
                return;
            }
            
            const semData = attendanceData.semesters[currentSem];
            const dateString = formatDate(selectedDate);
            
            if (!semData.holidays.includes(dateString)) {
                semData.holidays.push(dateString);
                semData.holidayNames[dateString] = holidayName;
                collegeLeaveCheckbox.checked = true;
                
                // If marked as holiday, can't be a working day or attended
                semData.workingDays = semData.workingDays.filter(d => d !== dateString);
                semData.attended = semData.attended.filter(d => d !== dateString);
                workingDayCheckbox.checked = false;
                wentToCollegeCheckbox.checked = false;
                
                // Add to dynamic holidays if not already there
                if (!attendanceData.dynamicHolidays.some(h => h.date === dateString)) {
                    attendanceData.dynamicHolidays.push({
                        name: holidayName,
                        date: dateString
                    });
                }
            }
            
            // Clear inputs
            holidayNameInput.value = '';
            saveData();
            renderCalendar(currentMonth, currentYear);
            updateStatusDisplay();
            renderDynamicHolidays();
        });
        
        // Add bulk holidays
        addBulkHolidayBtn.addEventListener('click', () => {
            const currentSem = semesterSelect.value;
            if (!currentSem) {
                alert('Please select a semester first');
                return;
            }
            
            const holidayName = bulkHolidayNameInput.value.trim();
            if (!holidayName) {
                alert('Please enter a holiday name');
                return;
            }
            
            const startDate = new Date(holidayStartInput.value);
            const endDate = new Date(holidayEndInput.value);
            
            if (isNaN(startDate.getTime())) {
                alert('Please select a valid start date');
                return;
            }
            
            if (isNaN(endDate.getTime())) {
                alert('Please select a valid end date');
                return;
            }
            
            if (startDate > endDate) {
                alert('End date must be after start date');
                return;
            }
            
            const semData = attendanceData.semesters[currentSem];
            
            // Add all dates in range
            // ...existing code...
            // Add all dates in range
            const currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                const dateString = formatDate(currentDate);
                if (!semData.holidays.includes(dateString)) {
                    semData.holidays.push(dateString);
                    semData.holidayNames[dateString] = holidayName;
                }
                // Remove from working days if present
                semData.workingDays = semData.workingDays.filter(d => d !== dateString);
                // Remove from attended if present
                semData.attended = semData.attended.filter(d => d !== dateString);
                currentDate.setDate(currentDate.getDate() + 1);
            }
            // ...existing code...
            
            // Add to bulk holidays
            attendanceData.bulkHolidays.push({
                name: holidayName,
                startDate: holidayStartInput.value,
                endDate: holidayEndInput.value
            });
            
            // Clear inputs
            bulkHolidayNameInput.value = '';
            holidayStartInput.value = holidayEndInput.value = '';
            
            saveData();
            renderCalendar(currentMonth, currentYear);
            updateStatusDisplay();
            renderBulkHolidays();
            
        });
        
        // Set working days range
        setWorkingDaysBtn.addEventListener('click', () => {
            const currentSem = semesterSelect.value;
            if (!currentSem) {
                alert('Please select a semester first');
                return;
            }
            
            const startDate = startDateInput.value;
            const endDate = endDateInput.value;
            
            if (!startDate) {
                alert('Please select a start date');
                return;
            }
            
            const semData = attendanceData.semesters[currentSem];
            semData.startDate = startDate;
            semData.endDate = endDate || formatDate(currentDate);
            
            // Update the end date input if it was empty
            if (!endDate) {
                endDateInput.value = semData.endDate;
            }
            
            updateWorkingDays(currentSem);
            renderCalendar(currentMonth, currentYear);
            updateStatusDisplay();
        });
        
        // Holiday type tabs in settings
        showStaticHolidaysBtn.addEventListener('click', () => {
            staticHolidaysList.style.display = 'block';
            dynamicHolidaysList.style.display = 'none';
            bulkHolidaysList.style.display = 'none';
        });
        
        showDynamicHolidaysBtn.addEventListener('click', () => {
            staticHolidaysList.style.display = 'none';
            dynamicHolidaysList.style.display = 'block';
            bulkHolidaysList.style.display = 'none';
        });
        
        showBulkHolidaysBtn.addEventListener('click', () => {
            staticHolidaysList.style.display = 'none';
            dynamicHolidaysList.style.display = 'none';
            bulkHolidaysList.style.display = 'block';
        });
        
        // Add static holiday
        addStaticHolidayBtn.addEventListener('click', () => {
            const name = newStaticHolidayName.value.trim();
            const date = newStaticHolidayDate.value;
            
            if (!name) {
                alert('Please enter a holiday name');
                return;
            }
            
            if (!date) {
                alert('Please select a date');
                return;
            }
            
            const dateObj = new Date(date);
            const monthDayStr = `${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            
            if (attendanceData.staticHolidays.some(h => h.date === monthDayStr)) {
                alert('A holiday already exists on this date');
                return;
            }
            
            attendanceData.staticHolidays.push({
                name: name,
                date: monthDayStr
            });
            
            // Clear inputs
            newStaticHolidayName.value = '';
            newStaticHolidayDate.value = '';
            
            saveData();
            renderStaticHolidays();
            renderCalendar(currentMonth, currentYear);
            updateStatusDisplay();
        });
        
        // Add dynamic holiday
        addDynamicHolidayBtn.addEventListener('click', () => {
            const name = newDynamicHolidayName.value.trim();
            const date = newDynamicHolidayDate.value;
            
            if (!name) {
                alert('Please enter a holiday name');
                return;
            }
            
            if (!date) {
                alert('Please select a date');
                return;
            }
            
            if (attendanceData.dynamicHolidays.some(h => h.date === date)) {
                alert('A holiday already exists on this date');
                return;
            }
            
            attendanceData.dynamicHolidays.push({
                name: name,
                date: date
            });
            
            // Clear inputs
            newDynamicHolidayName.value = '';
            newDynamicHolidayDate.value = '';
            
            saveData();
            renderDynamicHolidays();
            renderCalendar(currentMonth, currentYear);
            updateStatusDisplay();
        });
        
        // Add bulk holiday from settings
        addBulkHolidaySettingsBtn.addEventListener('click', () => {
            const name = newBulkHolidayName.value.trim();
            const startDate = newBulkHolidayStart.value;
            const endDate = newBulkHolidayEnd.value;
            
            if (!name) {
                alert('Please enter a holiday name');
                return;
            }
            
            if (!startDate || !endDate) {
                alert('Please select both start and end dates');
                return;
            }
            
            if (new Date(startDate) > new Date(endDate)) {
                alert('End date must be after start date');
                return;
            }
            
            attendanceData.bulkHolidays.push({
                name: name,
                startDate: startDate,
                endDate: endDate
            });
            
            // Clear inputs
            newBulkHolidayName.value = '';
            newBulkHolidayStart.value = '';
            newBulkHolidayEnd.value = '';
            
            saveData();
            renderBulkHolidays();
            renderCalendar(currentMonth, currentYear);
            updateStatusDisplay();
        });
        
        // Delete holiday event delegation
        staticHolidaysUl.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-holiday')) {
                const index = e.target.dataset.index;
                attendanceData.staticHolidays.splice(index, 1);
                saveData();
                renderStaticHolidays();
                renderCalendar(currentMonth, currentYear);
                updateStatusDisplay();
            }
        });
        
        dynamicHolidaysUl.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-holiday')) {
                const index = e.target.dataset.index;
                attendanceData.dynamicHolidays.splice(index, 1);
                saveData();
                renderDynamicHolidays();
                renderCalendar(currentMonth, currentYear);
                updateStatusDisplay();
            }
        });
        
        bulkHolidaysUl.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-holiday')) {
                const index = e.target.dataset.index;
                attendanceData.bulkHolidays.splice(index, 1);
                saveData();
                renderBulkHolidays();
                renderCalendar(currentMonth, currentYear);
                updateStatusDisplay();
            }
        });
    }
    
    // Initialize the app
    init();
});
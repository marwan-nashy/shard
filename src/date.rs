#[cfg(windows)]
pub fn today_local() -> String {
    #[repr(C)]
    struct SystemTime {
        year: u16,
        month: u16,
        day_of_week: u16,
        day: u16,
        hour: u16,
        minute: u16,
        second: u16,
        milliseconds: u16,
    }
    extern "system" {
        fn GetLocalTime(system_time: *mut SystemTime);
    }
    let mut value = SystemTime {
        year: 0,
        month: 0,
        day_of_week: 0,
        day: 0,
        hour: 0,
        minute: 0,
        second: 0,
        milliseconds: 0,
    };
    unsafe {
        GetLocalTime(&mut value);
    }
    format!("{:04}-{:02}-{:02}", value.year, value.month, value.day)
}

#[cfg(unix)]
pub fn today_local() -> String {
    use std::os::raw::c_long;

    #[repr(C)]
    struct TmBuffer {
        second: i32,
        minute: i32,
        hour: i32,
        day: i32,
        month: i32,
        year: i32,
        weekday: i32,
        yearday: i32,
        daylight_saving: i32,
        padding: [usize; 16],
    }

    extern "C" {
        fn localtime_r(time: *const c_long, result: *mut TmBuffer) -> *mut TmBuffer;
    }

    let seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as c_long;
    let mut local = std::mem::MaybeUninit::<TmBuffer>::uninit();
    let result = unsafe { localtime_r(&seconds, local.as_mut_ptr()) };
    if result.is_null() {
        return "1970-01-01".to_string();
    }
    let local = unsafe { local.assume_init() };
    format!(
        "{:04}-{:02}-{:02}",
        local.year + 1900,
        local.month + 1,
        local.day
    )
}

#[cfg(not(any(windows, unix)))]
pub fn today_local() -> String {
    let seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let shifted = seconds / 86_400 + 719_468;
    let era = if shifted >= 0 {
        shifted
    } else {
        shifted - 146_096
    } / 146_097;
    let day_of_era = shifted - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    year += i64::from(month <= 2);
    format!("{year:04}-{month:02}-{day:02}")
}

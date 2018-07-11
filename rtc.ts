
/**
 * Kitronik RTC blocks
 * RTC Chip: MCP7940-N
 * As per datasheet recommendation, the RTC oscilliation is stop on updating of values
 * This results in a small loss of time (under a 1 second per setting)
 * If this is important to your application, check the actual times
 */
//% weight=100 color=#00A654 icon="\uf017" block="Kitronik RTC"
namespace kitronik_RTC {

    //USEFUL CONSTANT
    const CHIP_ADDRESS = 0x6F 			//default Chip Write address
    const RTC_SECONDS_REG = 0x00		//the RTC seconds register
    const RTC_MINUTES_REG = 0x01		//the RTC minutes register
    const RTC_HOURS_REG = 0x02			//the RTC hours register
    const RTC_WEEKDAY_REG = 0x03		//the RTC week dat register
    const RTC_DAY_REG = 0x04			//the RTC date register
    const RTC_MONTH_REG = 0x05			//the RTC month register
    const RTC_YEAR_REG = 0x06			//the RTC year register
    const RTC_CONTROL_REG = 0x07		//the RTC control regisiter
    const RTC_OSCILLATOR_REG = 0x08 	//the oscillator digital trim register
    const RTC_PWR_UP_MINUTE_REG = 0x1C  //the RTC power up minute register

    const START_RTC = 0x80				//enable bit of seconds register
    const STOP_RTC = 0x00				//disable bit of seconds register

    const ENABLE_BATTERY_BACKUP = 0x08	//set bit for battery backup voltage enable
	
	//Global variable use so only one copy of current time and date value
    let currentSeconds = 0			
    let currentMinutes = 0
    let currentHours = 0
    let currentWeekDay = 0
    let currentDay = 0
    let currentMonth = 0
    let currentYear = 0
    let initalised = false    		//a flag to allow us to initialise without explicitly calling the secret incantation


    //decToBcd function to convert a decimal number to required Binary-Coded-Deceminal (bcd) for the RTC
    function decToBcd(Value: number) {

        let tens = 0
        let units = 0
        let bcdNumber = 0

        tens = Value / 10
        units = Value % 10

        bcdNumber = (tens << 4) | units;    // combine both tens and units for BCD number

        return bcdNumber
    }

    //bcdToDec function to convert a Binary-Coded-Deceminal to required decimal number for the micro:bit
    function bcdToDec(Value: number, readReg: number) {
        let mask = 0
        let shiftedTens = 0
        let units = 0
        let tens = 0
        let decNumber = 0

        switch (readReg) {
            case RTC_SECONDS_REG:         //case statments fall through as both require same mask value
            case RTC_MINUTES_REG:
                mask = 0x70
                break;
            case RTC_DAY_REG:
                mask = 0x30
                break;
            case RTC_HOURS_REG:           //case statments fall through as both require same mask value
            case RTC_MONTH_REG:
                mask = 0x10
                break;
            case RTC_YEAR_REG:
                mask = 0xF0
                break;
        }

        units = Value & 0x0F        	//Mask lower nibble  for units, mask upper nibble for tens and shift
        tens = Value & mask
        shiftedTens = tens >> 4

        decNumber = (shiftedTens * 10) + units     //convert both units and tens to one number

        return decNumber
    }


	/*
		This secret incantation sets up the MCP7940-N Real Time Clock.
		It should not need to be called directly be a user - the first RTC block will call this function.
	
	*/
    function secretIncantation(): void {
        let writeBuf = pins.createBuffer(2)
        let readBuf = pins.createBuffer(1)
        let running = 0
        let readCurrentSeconds = 0
        let readWeekDayReg = 0

        //Seconds register read for current seconds for when masking start RTC bit
        writeBuf[0] = RTC_SECONDS_REG
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)

        readBuf = pins.i2cReadBuffer(CHIP_ADDRESS, 1, false)
        readCurrentSeconds = readBuf[0]

        // First set the external oscillator
        writeBuf[0] = RTC_CONTROL_REG
        writeBuf[1] = 0x43										//only enable EXTOSC bit, external oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)

        //Reading weekday register so can mask the Battery backup supply
        writeBuf[0] = RTC_WEEKDAY_REG
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
        readBuf = pins.i2cReadBuffer(CHIP_ADDRESS, 1, false)
        readWeekDayReg = readBuf[0]

        writeBuf[0] = RTC_WEEKDAY_REG
        writeBuf[1] = ENABLE_BATTERY_BACKUP | readWeekDayReg             //logic OR the two bytes together for new value
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)       //write to enable battery backup and mask with current reading of register

        //Block write to start oscillator
        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = START_RTC | readCurrentSeconds
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)

        //set the initalised flag so we dont come in here again automatically
        initalised = true
    }

    //MAIN FUNCTION FOR READING ALL THE TIME AND DATE RESIGITER TO OUTPUT TO THE WORLD
    function readValue(): void {
        if (initalised == false) {
            secretIncantation()
        }

        let writeBuf = pins.createBuffer(1)
        let readBuf = pins.createBuffer(1)
        let readCurrentSeconds = 0

        //set read from seconds register to receive all the information to global varibles
        writeBuf[0] = RTC_SECONDS_REG
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)

        readBuf = pins.i2cReadBuffer(CHIP_ADDRESS, 7, false)
        currentSeconds = readBuf[0]
        currentMinutes = readBuf[1]
        currentHours = readBuf[2]
        currentWeekDay = readBuf[3]
        currentDay = readBuf[4]
        currentMonth = readBuf[5]
        currentYear = readBuf[6]
    }


    /**
     * Set time on RTC, as three numbers
     * @param setHours is to set the hours
     * @param setMinutes is to set the minutes
     * @param setSeconds is to set the seconds
    */
    //% blockId=kitronik_rtc_set_time 
    //% block="Set Time to %setHours|hrs %setMinutes|mins %setSeconds|secs"
    //% setHours.min=0 setHours.max=23
    //% setMinutes.min=0 setMinutes.max=59
    //% setSeconds.min=0 setSeconds.max=59
    //% weight=100 blockGap=8
    export function setTime(setHours: number, setMinutes: number, setSeconds: number): void {
		
		if (initalised == false) {
            secretIncantation()
        }
		
        let bcdHours = decToBcd(setHours)							//Convert number to binary coded decimal
        let bcdMinutes = decToBcd(setMinutes)						//Convert number to binary coded decimal
        let bcdSeconds = decToBcd(setSeconds)						//Convert number to binary coded decimal
        let writeBuf = pins.createBuffer(2)

        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = STOP_RTC									//Disable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)

        writeBuf[0] = RTC_HOURS_REG
        writeBuf[1] = bcdHours										//Send new Hours value
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)

        writeBuf[0] = RTC_MINUTES_REG
        writeBuf[1] = bcdMinutes									//Send new Minutes value
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)

        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = START_RTC | bcdSeconds							//Send new seconds masked with the Enable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
    }

	/**
     * Read time from RTC as a string
    */
    //% blockId=kitronik_rtc_read_time 
    //% block="Read Time as String"
    //% weight=95 blockGap=8
    export function readTime(): string {
        
		if (initalised == false) {
            secretIncantation()
        }
		
		//read Values
        readValue()

        let decSeconds = bcdToDec(currentSeconds, RTC_SECONDS_REG)					//Convert number to Decimal
        let decMinutes = bcdToDec(currentMinutes, RTC_MINUTES_REG)					//Convert number to Decimal
        let decHours = bcdToDec(currentHours, RTC_HOURS_REG)						//Convert number to Decimal

        //Combine hours,minutes and seconds in to one string
        let strTime: string = "" + decHours / 10 + decHours % 10 + ":" + decMinutes / 10 + decMinutes % 10 + ":" + decSeconds / 10 + decSeconds % 10

        return strTime
    }

    /**
     * Set date on RTC as three numbers
     * @param setDay is to set the day in terms of numbers 1 to 31
     * @param setMonths is to set the month in terms of numbers 1 to 12
     * @param setYears is to set the years in terms of numbers 0 to 99
    */
    //% blockId=kitronik_rtc_set_date 
    //% block="Set Date to %setDays|Day %setMonths|Month %setYear|Year"
    //% setDay.min=1 setDay.max=31
    //% setMonth.min=1 setMonth.max=12
    //% setYear.min=0 setYear.max=99
    //% weight=90 blockGap=8
    export function setDate(setDay: number, setMonth: number, setYear: number): void {
        
		if (initalised == false) {
            secretIncantation()
        }
		
		let leapYearCheck = 0
        let writeBuf = pins.createBuffer(2)
        let readBuf = pins.createBuffer(1)
        let bcdDay = 0
        let bcdMonths = 0
        let bcdYears = 0
        let readCurrentSeconds = 0

		//Check day entered does not exceed month that has 30 days in
        if ((setMonth == 4) || (setMonth == 6) || (setMonth == 9) || (setMonth == 11)) {
            if (setDay == 31) {
                setDay = 30
            }
        }
		
		//Leap year check and does not exceed 30 days
        if ((setMonth == 2) && (setDay >= 29)) {
            leapYearCheck = setYear % 4
            if (leapYearCheck == 0)
                setDay = 29
            else
                setDay = 28
        }

        bcdDay = decToBcd(setDay)						//Convert number to binary coded decimal
        bcdMonths = decToBcd(setMonth)					//Convert number to binary coded decimal
        bcdYears = decToBcd(setYear)					//Convert number to binary coded decimal

        writeBuf[0] = RTC_SECONDS_REG
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)

        readBuf = pins.i2cReadBuffer(CHIP_ADDRESS, 1, false)
        readCurrentSeconds = readBuf[0]

        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = STOP_RTC									//Disable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)

        writeBuf[0] = RTC_DAY_REG
        writeBuf[1] = bcdDay										//Send new Day value
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)

        writeBuf[0] = RTC_MONTH_REG
        writeBuf[1] = bcdMonths										//Send new Months value
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)

        writeBuf[0] = RTC_YEAR_REG
        writeBuf[1] = bcdYears										//Send new Year value
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)

        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = START_RTC | readCurrentSeconds					//Enable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
    }

	/**
     * Read date from RTC as a string
    */
    //% blockId=kitronik_rtc_read_date 
    //% block="Read Date as String"
    //% weight=85 blockGap=8
    export function readDate(): string {
        
		if (initalised == false) {
            secretIncantation()
        }
		
		//read Values
        readValue()

        let decDay = bcdToDec(currentDay, RTC_DAY_REG)						//Convert number to Decimal
        let decMonths = bcdToDec(currentMonth, RTC_MONTH_REG)				//Convert number to Decimal
        let decYears = bcdToDec(currentYear, RTC_YEAR_REG)					//Convert number to Decimal

        //let strDate: string = decDay + "/" + decMonths + "/" + decYears
        let strDate: string = "" + (decDay / 10) + (decDay % 10) + "/" + (decMonths / 10) + (decMonths % 10) + "/" + (decYears / 10) + (decYears % 10)
        return strDate
    }

    /**
     * Set the hours on the RTC in 24 hour format
     * @param writeHours is to set the hours in terms of numbers 0 to 23
    */
    //% subcategory=More
    //% blockId=kitronik_rtc_write_hours 
    //% block="Set Hours to %hours|hrs"
    //% hours.min=0 hours.max=23
    //% weight=80 blockGap=8
    export function writeHours(hours: number): void {
        if (initalised == false) {
            secretIncantation()
        }

        let bcdHours = decToBcd(hours)
        let writeBuf = pins.createBuffer(2)

        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = STOP_RTC										//Disable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
        writeBuf[0] = RTC_HOURS_REG
        writeBuf[1] = bcdHours										//Send new value
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = START_RTC									//Enable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
    }

    /**Read hours from RTC*/
    //% subcategory=More
    //% blockId=kitronik_rtc_read_hours 
    //% block="Read Hours as Number"
    //% weight=75 blockGap=8
    export function readHours(): number {
        
		if (initalised == false) {
            secretIncantation()
        }
		
		//read Values
        readValue()

        let decHours = bcdToDec(currentHours, RTC_HOURS_REG)					//Convert number to Decimal
        return decHours
    }

    /**
     * Set the minutes on the RTC
     * @param writeMinutes is to set the minutes in terms of numbers 0 to 59
    */
    //% subcategory=More
    //% blockId=kitronik_rtc_write_minutes 
    //% block="Set Minutes to %minutes|mins"
    //% minutes.min=0 minutes.max=59
    //% weight=70 blockGap=8
    export function writeMinutes(minutes: number): void {
        if (initalised == false) {
            secretIncantation()
        }

        let bcdMinutes = decToBcd(minutes)
        let writeBuf = pins.createBuffer(2)

        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = STOP_RTC										//Disable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
        writeBuf[0] = RTC_MINUTES_REG
        writeBuf[1] = bcdMinutes										//Send new value
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = START_RTC									//Enable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
    }

    /**Read minutes from RTC*/
    //% subcategory=More
    //% blockId=kitronik_rtc_read_minutes 
    //% block="Read Minutes as Number"
    //% weight=65 blockGap=8
    export function readMinutes(): number {
        
		if (initalised == false) {
            secretIncantation()
        }
		
		//read Values
        readValue()

        let decMinutes = bcdToDec(currentMinutes, RTC_MINUTES_REG)					//Convert number to Decimal
        return decMinutes
    }

    /**
     * Set the seconds on the RTC
     * @param writeSeconds is to set the seconds in terms of numbers 0 to 59
    */
    //% subcategory=More
    //% blockId=kitronik_rtc_write_seconds 
    //% block="Set Seconds to %seconds|secs"
    //% seconds.min=0 seconds.max=59
    //% weight=60 blockGap=8
    export function writeSeconds(seconds: number): void {
        if (initalised == false) {
            secretIncantation()
        }

        let bcdSeconds = decToBcd(seconds)
        let writeBuf = pins.createBuffer(2)

        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = STOP_RTC										//Disable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = START_RTC | bcdSeconds						//Enable Oscillator and Send new value
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
    }

    /**Read seconds from RTC*/
    //% subcategory=More
    //% blockId=kitronik_rtc_read_seconds 
    //% block="Read Seconds as Number"
    //% weight=55 blockGap=8
    export function readSeconds(): number {
        
		if (initalised == false) {
            secretIncantation()
        }
		
		//read Values
        readValue()

        let decSeconds = bcdToDec(currentSeconds, RTC_SECONDS_REG)					//Convert number to Decimal

        return decSeconds
    }


    /**
     * Set the day on the RTC
     * @param writeDay is to set the day in terms of numbers 0 to 31
    */
    //% subcategory=More
    //% blockId=kitronik_rtc_write_day
    //% block="Set Day to %day|day"
    //% day.min=1 day.max=31
    //% weight=50 blockGap=8
    export function writeDay(day: number): void {
        if (initalised == false) {
            secretIncantation()
        }

        let bcdDay = decToBcd(day)
        let writeBuf = pins.createBuffer(2)

        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = STOP_RTC										//Disable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
        writeBuf[0] = RTC_DAY_REG
        writeBuf[1] = bcdDay										//Send new value
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = START_RTC							//Enable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
    }

    /**Read day from RTC*/
    //% subcategory=More
    //% blockId=kitronik_rtc_read_day 
    //% block="Read Day as Number"
    //% weight=45 blockGap=8
    export function readDay(): number {
        
		if (initalised == false) {
            secretIncantation()
        }
		
		//read Values
        readValue()

        let decDay = bcdToDec(currentDay, RTC_DAY_REG)					//Convert number to Decimal

        return decDay
    }

    /**
     * set the month on the RTC
     * @param writeMonth is to set the month in terms of numbers 1 to 12
    */
    //% subcategory=More
    //% blockId=kitronik_rtc_write_month 
    //% block="Set Month to %month|month"
    //% month.min=1 month.max=12
    //% weight=40 blockGap=8
    export function writeMonth(month: number): void {
        if (initalised == false) {
            secretIncantation()
        }

        let bcdMonth = decToBcd(month)
        let writeBuf = pins.createBuffer(2)

        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = STOP_RTC										//Disable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
        writeBuf[0] = RTC_MONTH_REG
        writeBuf[1] = bcdMonth										//Send new value
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = START_RTC										//Enable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
    }

    /**Read month from RTC*/
    //% subcategory=More
    //% blockId=kitronik_rtc_read_month 
    //% block="Read Month as Number"
    //% weight=35 blockGap=8
    export function readMonth(): number {
        
		if (initalised == false) {
            secretIncantation()
        }
		
		//read Values
        readValue()

        //pins.i2cReadBuffer(CHIP_ADDRESS, buf, false)
        let decMonths = bcdToDec(currentMonth, RTC_MONTH_REG)					//Convert number to Decimal

        return decMonths
    }

    /**
     * set the year on the RTC
     * @param writeYear is to set the year in terms of numbers 0 to 99
    */
    //% subcategory=More
    //% blockId=kitronik_rtc_write_year 
    //% block="Set Year to %year|year"
    //% year.min=0 year.max=99
    //% weight=30 blockGap=8
    export function writeYear(year: number): void {
        if (initalised == false) {
            secretIncantation()
        }

        let bcdYear = decToBcd(year)								//Convert number to BCD
        let writeBuf = pins.createBuffer(2)

        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = STOP_RTC										//Disable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
        writeBuf[0] = RTC_YEAR_REG
        writeBuf[1] = bcdYear										//Send new value
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
        writeBuf[0] = RTC_SECONDS_REG
        writeBuf[1] = START_RTC									//Enable Oscillator
        pins.i2cWriteBuffer(CHIP_ADDRESS, writeBuf, false)
    }

    /**Read year from RTC*/
    //% subcategory=More
    //% blockId=kitronik_rtc_read_year 
    //% block="Read Year as Number"
    //% weight=25 blockGap=8
    export function readYear(): number {
        
		if (initalised == false) {
            secretIncantation()
        }
		
		//read Values
        readValue()

        let decYears = bcdToDec(currentYear, RTC_YEAR_REG)					//Convert number to Decimal

        return decYears
    }
}

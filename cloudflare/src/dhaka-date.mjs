// Workers run in UTC. Preserve the original school's Bangladesh calendar rules.
const NativeDate = globalThis.Date;
const OFFSET = 6 * 60 * 60 * 1000;
export class DhakaDate extends NativeDate {
  constructor(...args) {
    if (args.length > 1) super(NativeDate.UTC(...args) - OFFSET);
    else if (typeof args[0] === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(args[0])) super(args[0] + "+06:00");
    else if (args.length) super(args[0]);
    else super();
  }
  local() { return new NativeDate(this.getTime() + OFFSET); }
  getFullYear() { return this.local().getUTCFullYear(); }
  getMonth() { return this.local().getUTCMonth(); }
  getDate() { return this.local().getUTCDate(); }
  getDay() { return this.local().getUTCDay(); }
  getHours() { return this.local().getUTCHours(); }
  getMinutes() { return this.local().getUTCMinutes(); }
  getSeconds() { return this.local().getUTCSeconds(); }
  getMilliseconds() { return this.local().getUTCMilliseconds(); }
  getTimezoneOffset() { return -360; }
  setDate(...args) { const d = this.local(); return this.setTime(d.setUTCDate(...args) - OFFSET); }
  setMonth(...args) { const d = this.local(); return this.setTime(d.setUTCMonth(...args) - OFFSET); }
  setFullYear(...args) { const d = this.local(); return this.setTime(d.setUTCFullYear(...args) - OFFSET); }
  setHours(...args) { const d = this.local(); return this.setTime(d.setUTCHours(...args) - OFFSET); }
  setMinutes(...args) { const d = this.local(); return this.setTime(d.setUTCMinutes(...args) - OFFSET); }
  toLocaleDateString(locale, options = {}) { return super.toLocaleDateString(locale, { timeZone: "Asia/Dhaka", ...options }); }
  toLocaleTimeString(locale, options = {}) { return super.toLocaleTimeString(locale, { timeZone: "Asia/Dhaka", ...options }); }
  toLocaleString(locale, options = {}) { return super.toLocaleString(locale, { timeZone: "Asia/Dhaka", ...options }); }
}

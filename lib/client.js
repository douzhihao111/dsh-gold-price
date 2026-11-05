window.__ModuleLoader__.load({
	id: "dsh-gold-price",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const h = React.createElement;

		const PANEL_ID = "gold-price";
		const QUOTE_ENDPOINT = "https://push2.eastmoney.com/api/qt/ulist.np/get";
		const TREND_ENDPOINT = "https://push2.eastmoney.com/api/qt/stock/trends2/get";
		const QUOTE_FIELDS = "f2,f3,f4,f12,f13,f14,f15,f16,f17,f18,f124";
		const TREND_FIELDS_1 = "f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13";
		const TREND_FIELDS_2 = "f51,f52,f53,f54,f55,f56,f57,f58";
		const REFRESH_MS = 5000;
		const TREND_REFRESH_MS = 30000;

		/** The domestic contracts shown on the panel, in display order. */
		const PRODUCTS = [
			{ code: "AU9999", secid: "118.AU9999", name: "黄金9999", market: "SGE", primary: true },
			{ code: "AUTD", secid: "118.AUTD", name: "黄金T+D", market: "SGE" },
			{ code: "SHAU", secid: "118.SHAU", name: "上海金", market: "SGE" },
			{ code: "aum", secid: "113.aum", name: "沪金主连", market: "SHFE" }
		];

		const CHART_WIDTH = 1000;
		const CHART_HEIGHT = 250;
		const CHART_PAD_TOP = 18;
		const CHART_PAD_BOTTOM = 18;

		// ---------------------------------------------------------------------
		// Formatting
		// ---------------------------------------------------------------------

		const PRICE_FORMAT = new Intl.NumberFormat("zh-CN", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
		const CLOCK_FORMAT = new Intl.DateTimeFormat("zh-CN", {
			timeZone: "Asia/Shanghai",
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit"
		});
		const SHORT_CLOCK_FORMAT = new Intl.DateTimeFormat("zh-CN", {
			timeZone: "Asia/Shanghai",
			hour12: false,
			hour: "2-digit",
			minute: "2-digit"
		});

		function readNumber(value) {
			if (typeof value === "number") return Number.isFinite(value) ? value : null;
			if (typeof value === "string" && value.trim() !== "" && value.trim() !== "-") {
				const number = Number(value);
				return Number.isFinite(number) ? number : null;
			}
			return null;
		}

		function formatPrice(value) {
			return value === null || value === undefined || !Number.isFinite(value) ? "—" : PRICE_FORMAT.format(value);
		}

		function formatSigned(value, digits) {
			if (value === null || value === undefined || !Number.isFinite(value)) return "—";
			const fixed = Math.abs(value).toFixed(digits === undefined ? 2 : digits);
			if (value > 0) return "+" + fixed;
			if (value < 0) return "-" + fixed;
			return fixed;
		}

		function formatPercent(value) {
			if (value === null || value === undefined || !Number.isFinite(value)) return "—";
			return (value > 0 ? "+" : "") + value.toFixed(2) + "%";
		}

		function formatClock(milliseconds) {
			if (!milliseconds || !Number.isFinite(milliseconds)) return "—";
			return CLOCK_FORMAT.format(new Date(milliseconds));
		}

		function shortTrendTime(value) {
			return typeof value === "string" && value.length >= 16 ? value.slice(11, 16) : String(value);
		}

		function toneOf(value) {
			if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return "dgp-flat";
			return value > 0 ? "dgp-up" : "dgp-down";
		}

		function changeLabel(product) {
			if (!product || product.change === null || product.change === undefined || product.pct === null || product.pct === undefined) return "—";
			const arrow = product.change > 0 ? "▲" : product.change < 0 ? "▼" : "•";
			return arrow + " " + formatSigned(product.change) + "  " + formatPercent(product.pct);
		}

		function describeError(error) {
			if (!error) return "行情服务暂不可用";
			if (error.name === "AbortError") return "请求超时，请稍后重试";
			if (error instanceof TypeError) return "无法连接行情服务，请检查网络或代理设置";
			if (error.message === "EMPTY" || error.message === "EMPTY_TREND") return "行情服务返回了空数据";
			return "行情服务返回异常，请稍后重试";
		}

		function findProduct(quotes, code) {
			if (!quotes) return undefined;
			for (const product of quotes) if (product.code === code) return product;
			return undefined;
		}

		function latestTimestamp(quotes) {
			if (!quotes) return 0;
			let latest = 0;
			for (const product of quotes) if (product.ts && product.ts > latest) latest = product.ts;
			return latest;
		}

		// ---------------------------------------------------------------------
		// Data access and shared store
		// ---------------------------------------------------------------------

		async function fetchJson(url) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 9000);
			try {
				const response = await fetch(url, {
					signal: controller.signal,
					cache: "no-store",
					credentials: "omit",
					headers: { Accept: "application/json" }
				});
				if (!response.ok) throw new Error("HTTP " + response.status);
				return await response.json();
			} finally {
				clearTimeout(timeout);
			}
		}

		function quoteUrl() {
			const params = new URLSearchParams({
				fltt: "2",
				secids: PRODUCTS.map((product) => product.secid).join(","),
				fields: QUOTE_FIELDS,
				_: String(Date.now())
			});
			return QUOTE_ENDPOINT + "?" + params.toString();
		}

		function trendUrl() {
			const params = new URLSearchParams({
				secid: "118.AU9999",
				fields1: TREND_FIELDS_1,
				fields2: TREND_FIELDS_2,
				ndays: "1",
				iscr: "0",
				_: String(Date.now())
			});
			return TREND_ENDPOINT + "?" + params.toString();
		}

		async function fetchQuotes() {
			const payload = await fetchJson(quoteUrl());
			const rows = payload && payload.data && Array.isArray(payload.data.diff) ? payload.data.diff : [];
			if (rows.length === 0) throw new Error("EMPTY");
			const byCode = new Map();
			for (const row of rows) if (row && typeof row.f12 === "string") byCode.set(row.f12, row);
			return PRODUCTS.map((product) => {
				const row = byCode.get(product.code) || {};
				return {
					...product,
					price: readNumber(row.f2),
					change: readNumber(row.f4),
					pct: readNumber(row.f3),
					high: readNumber(row.f15),
					low: readNumber(row.f16),
					open: readNumber(row.f17),
					prevClose: readNumber(row.f18),
					ts: readNumber(row.f124)
				};
			});
		}

		async function fetchTrend() {
			const payload = await fetchJson(trendUrl());
			const data = payload && payload.data ? payload.data : null;
			if (!data || !Array.isArray(data.trends)) throw new Error("EMPTY_TREND");
			const points = [];
			for (const line of data.trends) {
				if (typeof line !== "string") continue;
				const parts = line.split(",");
				if (parts.length < 3) continue;
				const price = readNumber(parts[2]);
				if (price === null || price <= 0) continue;
				points.push({ time: parts[0], price });
			}
			if (points.length < 2) throw new Error("EMPTY_TREND");
			return { points, preClose: readNumber(data.preClose) };
		}

		let storeState = {
			quotes: null,
			trend: null,
			error: null,
			trendError: null,
			loading: true,
			updatedAt: null
		};
		const storeListeners = new Set();
		let storeRefs = 0;
		let quoteTimer = null;
		let trendTimer = null;
		let quoteBusy = false;
		let trendBusy = false;

		function publish(patch) {
			storeState = Object.assign({}, storeState, patch);
			for (const listener of storeListeners) {
				try {
					listener();
				} catch (error) {
					console.error("[gold-price] store listener failed", error);
				}
			}
		}

		function getStoreSnapshot() {
			return storeState;
		}

		function isDocumentVisible() {
			return typeof document === "undefined" || document.visibilityState !== "hidden";
		}

		async function refreshQuotes(force) {
			if (!force && !isDocumentVisible()) return;
			if (quoteBusy) return;
			quoteBusy = true;
			try {
				const quotes = await fetchQuotes();
				publish({ quotes, error: null, loading: false, updatedAt: Date.now() });
			} catch (error) {
				publish({ error: describeError(error), loading: false });
			} finally {
				quoteBusy = false;
			}
		}

		async function refreshTrend(force) {
			if (!force && !isDocumentVisible()) return;
			if (trendBusy) return;
			trendBusy = true;
			try {
				const trend = await fetchTrend();
				publish({ trend, trendError: null });
			} catch (error) {
				publish({ trendError: describeError(error) });
			} finally {
				trendBusy = false;
			}
		}

		function refreshAll() {
			refreshQuotes(true);
			refreshTrend(true);
		}

		function handleVisibilityChange() {
			if (isDocumentVisible()) refreshAll();
		}

		function startPolling() {
			if (quoteTimer !== null) return;
			refreshQuotes(true);
			refreshTrend(true);
			quoteTimer = setInterval(() => refreshQuotes(false), REFRESH_MS);
			trendTimer = setInterval(() => refreshTrend(false), TREND_REFRESH_MS);
			if (typeof document !== "undefined") document.addEventListener("visibilitychange", handleVisibilityChange);
		}

		function stopPolling() {
			if (quoteTimer === null) return;
			clearInterval(quoteTimer);
			clearInterval(trendTimer);
			quoteTimer = null;
			trendTimer = null;
			if (typeof document !== "undefined") document.removeEventListener("visibilitychange", handleVisibilityChange);
		}

		function subscribeStore(listener) {
			storeListeners.add(listener);
			storeRefs += 1;
			if (storeRefs === 1) startPolling();
			return function unsubscribe() {
				storeListeners.delete(listener);
				storeRefs -= 1;
				if (storeRefs <= 0) {
					storeRefs = 0;
					stopPolling();
				}
			};
		}

		function useMarketData() {
			return React.useSyncExternalStore(subscribeStore, getStoreSnapshot, getStoreSnapshot);
		}

		function useClock(interval) {
			const [now, setNow] = React.useState(() => Date.now());
			React.useEffect(() => {
				const timer = setInterval(() => setNow(Date.now()), interval);
				return () => clearInterval(timer);
			}, [interval]);
			return now;
		}

		// ---------------------------------------------------------------------
		// Chart geometry
		// ---------------------------------------------------------------------

		function buildAxisLabels(points) {
			const labels = [];
			const used = new Set();
			const add = (index, label, align) => {
				if (index === null || index === undefined || index < 0 || index >= points.length || used.has(index)) return;
				used.add(index);
				labels.push({ index, label, align });
			};
			add(0, shortTrendTime(points[0].time), "start");
			const minuteTargets = [
				[0, "00:00"],
				[9 * 60, "09:00"]
			];
			for (const [targetMinutes, targetLabel] of minuteTargets) {
				let best = -1;
				let bestDistance = Infinity;
				for (let i = 1; i < points.length - 1; i += 1) {
					const clock = shortTrendTime(points[i].time);
					const parts = clock.split(":");
					if (parts.length !== 2) continue;
					const minutes = Number(parts[0]) * 60 + Number(parts[1]);
					if (!Number.isFinite(minutes)) continue;
					const distance = Math.abs(minutes - targetMinutes);
					if (distance < bestDistance) {
						bestDistance = distance;
						best = i;
					}
				}
				if (best > 0 && bestDistance <= 20) add(best, targetLabel, "middle");
			}
			add(points.length - 1, shortTrendTime(points[points.length - 1].time), "end");
			labels.sort((left, right) => left.index - right.index);
			return labels;
		}

		function buildGeometry(points, preClose) {
			const values = points.map((point) => point.price);
			let min = Math.min.apply(null, values);
			let max = Math.max.apply(null, values);
			if (preClose !== null && preClose !== undefined) {
				min = Math.min(min, preClose);
				max = Math.max(max, preClose);
			}
			const rawSpan = max - min;
			const pad = rawSpan > 0 ? rawSpan * 0.08 : Math.max(0.5, max * 0.001);
			const lo = min - pad;
			const hi = max + pad;
			const span = hi - lo || 1;
			const x = (index) => (points.length <= 1 ? CHART_WIDTH / 2 : (index / (points.length - 1)) * CHART_WIDTH);
			const y = (value) => CHART_PAD_TOP + ((hi - value) / span) * (CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM);
			let line = "";
			for (let i = 0; i < points.length; i += 1) {
				line += (i === 0 ? "M" : "L") + x(i).toFixed(2) + "," + y(points[i].price).toFixed(2);
			}
			const area = line + "L" + CHART_WIDTH + "," + CHART_HEIGHT + "L0," + CHART_HEIGHT + "Z";
			return {
				line,
				area,
				x,
				y,
				min,
				max,
				last: points[points.length - 1],
				prevY: preClose === null || preClose === undefined ? null : y(preClose),
				labels: buildAxisLabels(points)
			};
		}

		// ---------------------------------------------------------------------
		// Icons
		// ---------------------------------------------------------------------

		function GoldIcon(props) {
			const size = props && props.size ? props.size : 18;
			return h(
				"svg",
				{
					width: size,
					height: size,
					viewBox: "0 0 24 24",
					fill: "none",
					"aria-hidden": "true",
					focusable: "false"
				},
				h("path", {
					d: "M5.2 8.4 7.1 4.5h9.8l1.9 3.9",
					stroke: "currentColor",
					strokeWidth: "1.6",
					strokeLinejoin: "round"
				}),
				h("rect", {
					x: "3.4",
					y: "8.4",
					width: "17.2",
					height: "5.5",
					rx: "1.4",
					stroke: "currentColor",
					strokeWidth: "1.6"
				}),
				h("rect", {
					x: "5.4",
					y: "13.9",
					width: "13.2",
					height: "5.3",
					rx: "1.3",
					stroke: "currentColor",
					strokeWidth: "1.6"
				}),
				h("path", {
					d: "M9.4 11.15h5.2",
					stroke: "currentColor",
					strokeWidth: "1.4",
					strokeLinecap: "round",
					opacity: "0.55"
				})
			);
		}

		function RefreshIcon(props) {
			const size = props && props.size ? props.size : 15;
			return h(
				"svg",
				{ width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", focusable: "false" },
				h("path", {
					d: "M13 8a5 5 0 1 1-1.46-3.54",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round"
				}),
				h("path", {
					d: "M13 2.6v2.9H10.1",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			);
		}

		// ---------------------------------------------------------------------
		// Components
		// ---------------------------------------------------------------------

		function SidebarGoldTicker(props) {
			const state = useMarketData();
			const primary = findProduct(state.quotes, "AU9999");
			const wide = props && props.wide === true;
			const tone = toneOf(primary ? primary.change : null);
			const label = primary && primary.price !== null
				? "国内金价 " + formatPrice(primary.price) + " 元/克 " + formatPercent(primary.pct)
				: "国内金价";
			return h(
				"button",
				{
					type: "button",
					className: "dgp-ticker" + (wide ? " dgp-ticker-wide" : ""),
					title: label,
					"aria-label": label + "，打开金价面板",
					onClick: props && props.onOpen
				},
				h("span", { className: "dgp-ticker-icon" }, h(GoldIcon, { size: wide ? 16 : 19 })),
				wide ? h("span", { className: "dgp-ticker-label" }, "金价") : null,
				wide ? h("span", { className: "dgp-ticker-value " + tone }, primary ? formatPrice(primary.price) : "—") : null,
				wide && primary && primary.pct !== null
					? h("span", { className: "dgp-ticker-pct " + tone }, formatPercent(primary.pct))
					: null
			);
		}

		function Header(props) {
			return h(
				"header",
				{ className: "dgp-header" },
				h(
					"div",
					{ className: "dgp-heading" },
					h("h1", null, "国内金价"),
					h("p", null, "上海黄金交易所 · 上海期货交易所 实时行情")
				),
				h(
					"div",
					{ className: "dgp-toolbar" },
					h(
						"span",
						{
							className: "dgp-live" + (props.live ? "" : " dgp-live-off"),
							title: props.dataTs ? "行情时间 " + formatClock(props.dataTs * 1000) : "等待行情"
						},
						h("span", { className: "dgp-live-dot" }),
						props.status
					),
					h(
						"button",
						{ type: "button", className: "dgp-button", onClick: props.onRefresh, title: "立即刷新行情" },
						h("span", { className: "dgp-button-icon" + (props.spinning ? " dgp-spin" : "") }, h(RefreshIcon, { size: 15 })),
						"刷新"
					)
				)
			);
		}

		function Hero(props) {
			const primary = props.primary;
			const stats = [
				["今开", primary.open],
				["昨收", primary.prevClose],
				["最高", primary.high],
				["最低", primary.low]
			];
			return h(
				"div",
				{ className: "dgp-hero" },
				h(
					"div",
					{ className: "dgp-hero-main" },
					h(
						"div",
						{ className: "dgp-eyebrow" },
						h("span", { className: "dgp-badge" }, "SGE"),
						h("span", null, "黄金9999 · Au99.99")
					),
					h(
						"div",
						{ className: "dgp-price-row" },
						h("span", { className: "dgp-price" }, formatPrice(primary.price)),
						h("span", { className: "dgp-unit" }, "元/克")
					),
					h(
						"div",
						{ className: "dgp-change " + toneOf(primary.change) },
						changeLabel(primary),
						h("span", { className: "dgp-change-note" }, "较昨收")
					)
				),
				h(
					"div",
					{ className: "dgp-stats" },
					stats.map(([label, value]) =>
						h(
							"div",
							{ className: "dgp-stat", key: label },
							h("span", { className: "dgp-stat-label" }, label),
							h("span", { className: "dgp-stat-value" }, formatPrice(value))
						)
					)
				)
			);
		}

		function RangeBar(props) {
			const low = props.low;
			const high = props.high;
			const price = props.price;
			if (!Number.isFinite(low) || !Number.isFinite(high) || !Number.isFinite(price) || high <= low) return null;
			const percent = Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
			return h(
				"div",
				{ className: "dgp-range", "aria-hidden": "true" },
				h("span", { className: "dgp-range-dot", style: { left: percent + "%" } })
			);
		}

		function ProductCard(props) {
			const product = props.product;
			if (!product) {
				return h(
					"article",
					{ className: "dgp-card dgp-card-loading", "aria-busy": "true" },
					h("div", { className: "dgp-skeleton dgp-skeleton-card-title" }),
					h("div", { className: "dgp-skeleton dgp-skeleton-card-price" }),
					h("div", { className: "dgp-skeleton dgp-skeleton-card-line" })
				);
			}
			return h(
				"article",
				{ className: "dgp-card" },
				h(
					"div",
					{ className: "dgp-card-head" },
					h(
						"div",
						null,
						h("div", { className: "dgp-card-name" }, product.name),
						h("div", { className: "dgp-card-code" }, product.market + " · " + product.code)
					)
				),
				h("div", { className: "dgp-card-price" }, formatPrice(product.price)),
				h("div", { className: "dgp-card-change " + toneOf(product.change) }, changeLabel(product)),
				h(RangeBar, { low: product.low, high: product.high, price: product.price }),
				h(
					"div",
					{ className: "dgp-card-meta" },
					"最高 " + formatPrice(product.high) + " · 最低 " + formatPrice(product.low)
				)
			);
		}

		function IntradayChart(props) {
			const trend = props.trend;
			const points = trend.points;
			const [hover, setHover] = React.useState(null);
			const geometry = React.useMemo(
				() => (points.length >= 2 ? buildGeometry(points, trend.preClose) : null),
				[points, trend.preClose]
			);
			React.useEffect(() => {
				setHover(null);
			}, [points]);

			if (!geometry) return h("div", { className: "dgp-chart-empty" }, "暂无足够的分时数据");

			const ratio = hover === null ? 0 : hover / Math.max(1, points.length - 1);
			const hovered = hover === null ? null : points[hover];
			const tooltipClass =
				"dgp-tooltip" + (ratio > 0.68 ? " dgp-tooltip-right" : ratio < 0.08 ? " dgp-tooltip-left" : "");
			const gridRatios = [0.25, 0.5, 0.75];
			const yTop = CHART_PAD_TOP;
			const yBottom = CHART_HEIGHT - CHART_PAD_BOTTOM;

			return h(
				"div",
				{ className: "dgp-chart-body" },
				h(
					"div",
					{
						className: "dgp-plot",
						onPointerMove: (event) => {
							const rect = event.currentTarget.getBoundingClientRect();
							if (!rect.width) return;
							const position = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
							setHover(Math.round(position * (points.length - 1)));
						},
						onPointerLeave: () => setHover(null),
						onPointerCancel: () => setHover(null)
					},
					h(
						"svg",
						{
							viewBox: "0 0 " + CHART_WIDTH + " " + CHART_HEIGHT,
							preserveAspectRatio: "none",
							role: "img",
							"aria-label": "黄金9999 日内走势，最新 " + formatPrice(geometry.last.price) + " 元/克"
						},
						h(
							"defs",
							null,
							h(
								"linearGradient",
								{ id: "dgp-area-fill", x1: "0", y1: "0", x2: "0", y2: "1" },
								h("stop", { offset: "0%", stopColor: "var(--dgp-gold)", stopOpacity: "0.3" }),
								h("stop", { offset: "100%", stopColor: "var(--dgp-gold)", stopOpacity: "0.02" })
							)
						),
						gridRatios.map((gridRatio) =>
							h("line", {
								key: gridRatio,
								x1: 0,
								x2: CHART_WIDTH,
								y1: yTop + gridRatio * (yBottom - yTop),
								y2: yTop + gridRatio * (yBottom - yTop),
								stroke: "var(--dsw-alias-border-l4)",
								strokeWidth: "1",
								vectorEffect: "non-scaling-stroke",
								opacity: "0.65"
							})
						),
						geometry.prevY === null
							? null
							: h("line", {
									x1: 0,
									x2: CHART_WIDTH,
									y1: geometry.prevY,
									y2: geometry.prevY,
									stroke: "var(--dsw-alias-label-caption)",
									strokeWidth: "1",
									strokeDasharray: "4 5",
									vectorEffect: "non-scaling-stroke",
									opacity: "0.75"
							  }),
						h("path", { d: geometry.area, fill: "url(#dgp-area-fill)" }),
						h("path", {
							d: geometry.line,
							fill: "none",
							stroke: "var(--dgp-gold)",
							strokeWidth: "2",
							strokeLinejoin: "round",
							strokeLinecap: "round",
							vectorEffect: "non-scaling-stroke"
						}),
						hover === null
							? null
							: h("line", {
									x1: geometry.x(hover),
									x2: geometry.x(hover),
									y1: yTop,
									y2: yBottom,
									stroke: "var(--dgp-gold)",
									strokeWidth: "1",
									strokeDasharray: "3 4",
									vectorEffect: "non-scaling-stroke",
									opacity: "0.8"
							  }),
						hover === null || hovered === null
							? null
							: h("circle", {
									cx: geometry.x(hover),
									cy: geometry.y(hovered.price),
									r: "4.5",
									fill: "var(--dgp-gold)",
									stroke: "var(--dsw-alias-bg-base)",
									strokeWidth: "2",
									vectorEffect: "non-scaling-stroke"
							  })
					),
					hover === null && geometry.prevY !== null
						? h(
								"span",
								{ className: "dgp-prev-tag", style: { top: (geometry.prevY / CHART_HEIGHT) * 100 + "%" } },
								"昨收 " + formatPrice(trend.preClose)
						  )
						: null,
					hovered === null
						? null
						: h(
								"div",
								{ className: tooltipClass, style: { left: ratio * 100 + "%" } },
								h("span", { className: "dgp-tooltip-time" }, shortTrendTime(hovered.time)),
								h("span", { className: "dgp-tooltip-price" }, formatPrice(hovered.price) + " 元/克")
						  )
				),
				h(
					"div",
					{ className: "dgp-axis" },
					geometry.labels.map((label) =>
						h(
							"span",
							{
								key: label.index,
								className: "dgp-axis-label dgp-axis-" + label.align,
								style: { left: (label.index / Math.max(1, points.length - 1)) * 100 + "%" }
							},
							label.label
						)
					)
				)
			);
		}

		function ChartCard(props) {
			const trend = props.trend;
			const error = props.error;
			const range = React.useMemo(() => {
				if (!trend || !Array.isArray(trend.points) || trend.points.length === 0) return null;
				let high = -Infinity;
				let low = Infinity;
				for (const point of trend.points) {
					if (point.price > high) high = point.price;
					if (point.price < low) low = point.price;
				}
				return { high, low };
			}, [trend]);
			return h(
				"section",
				{ className: "dgp-card dgp-chart-card", "aria-labelledby": "dgp-chart-title" },
				h(
					"div",
					{ className: "dgp-chart-head" },
					h(
						"div",
						{ className: "dgp-chart-title" },
						h("h2", { id: "dgp-chart-title" }, "日内走势"),
						h("p", null, "黄金9999 · Au99.99 · 北京时间")
					),
					trend
						? h(
								"div",
								{ className: "dgp-chart-side" },
								h(
									"div",
									{ className: "dgp-chart-legend" },
									h("span", { className: "dgp-legend-line" }),
									h("span", null, "价格"),
									trend.preClose === null || trend.preClose === undefined
										? null
										: h("span", { className: "dgp-legend-dash" }),
									trend.preClose === null || trend.preClose === undefined
										? null
										: h("span", null, "昨收")
								),
								range
									? h(
											"div",
											{ className: "dgp-chart-facts" },
											"最高 " + formatPrice(range.high) + " · 最低 " + formatPrice(range.low)
									  )
									: null
						  )
						: null
				),
				trend
					? h(IntradayChart, { trend })
					: h(
							"div",
							{ className: "dgp-chart-empty" },
							error ? "走势暂不可用：" + error : "正在加载日内走势…"
					  )
			);
		}

		function ErrorState(props) {
			return h(
				"div",
				{ className: "dgp-error-card" },
				h("div", { className: "dgp-error-icon" }, h(GoldIcon, { size: 30 })),
				h("h2", null, "暂时拿不到行情"),
				h("p", null, props.message || "请检查网络后重试。"),
				h("button", { type: "button", className: "dgp-button dgp-button-primary", onClick: props.onRetry }, "重新加载")
			);
		}

		function LoadingHero() {
			return h(
				"div",
				{ className: "dgp-hero dgp-hero-loading", "aria-busy": "true" },
				h(
					"div",
					{ className: "dgp-hero-main" },
					h("div", { className: "dgp-skeleton dgp-skeleton-eyebrow" }),
					h("div", { className: "dgp-skeleton dgp-skeleton-price" }),
					h("div", { className: "dgp-skeleton dgp-skeleton-line" })
				),
				h(
					"div",
					{ className: "dgp-stats" },
					[0, 1, 2, 3].map((index) =>
						h(
							"div",
							{ className: "dgp-stat", key: index },
							h("div", { className: "dgp-skeleton dgp-skeleton-stat-label" }),
							h("div", { className: "dgp-skeleton dgp-skeleton-stat-value" })
						)
					)
				)
			);
		}

		function GoldPricePage() {
			const state = useMarketData();
			const now = useClock(5000);
			const [spinning, setSpinning] = React.useState(false);
			const primary = findProduct(state.quotes, "AU9999");
			const dataTs = latestTimestamp(state.quotes);
			const age = dataTs ? now - dataTs * 1000 : null;
			// A quote timestamp can sit a second or two ahead of the browser clock;
			// treat a small negative age as fresh instead of flipping to "已休市".
			const live = age !== null && age > -2 * 60 * 1000 && age < 3 * 60 * 1000;
			const status = !state.quotes && state.error
				? "连接失败"
				: live
				? "交易中"
				: state.loading
				? "连接中"
				: "已休市";

			const refresh = () => {
				refreshAll();
				setSpinning(true);
			};

			React.useEffect(() => {
				if (!spinning) return;
				const timer = setTimeout(() => setSpinning(false), 900);
				return () => clearTimeout(timer);
			}, [spinning]);

			const content = [
				h(Header, {
					key: "header",
					status,
					live,
					dataTs,
					onRefresh: refresh,
					spinning
				})
			];

			if (state.error && state.quotes) {
				content.push(
					h(
						"div",
						{ className: "dgp-banner", role: "status", key: "banner" },
						h("span", null, "行情刷新失败，正在显示最近一次成功数据。"),
						h("button", { type: "button", className: "dgp-banner-action", onClick: refresh }, "重试")
					)
				);
			}

			if (primary) {
				content.push(h(Hero, { key: "hero", primary }));
				content.push(
					h(
						"div",
						{ className: "dgp-grid", key: "cards" },
						["AUTD", "SHAU", "aum"].map((code) =>
							h(ProductCard, { key: code, product: findProduct(state.quotes, code) })
						)
					)
				);
				content.push(h(ChartCard, { key: "chart", trend: state.trend, error: state.trendError }));
			} else if (state.error) {
				content.push(h(ErrorState, { key: "error", message: state.error, onRetry: refresh }));
			} else if (state.quotes) {
				content.push(
					h(ErrorState, {
						key: "missing-primary",
						message: "行情已返回，但未找到黄金9999报价，请稍后重试。",
						onRetry: refresh
					})
				);
			} else {
				content.push(h(LoadingHero, { key: "loading" }));
				content.push(
					h(
						"div",
						{ className: "dgp-grid", key: "skeleton-cards" },
						[0, 1, 2].map((index) => h(ProductCard, { key: index, product: null }))
					)
				);
			}

			content.push(
				h(
					"div",
					{ className: "dgp-footer", key: "footer" },
					h(
						"span",
						{ className: "dgp-refresh-note" },
						"每 5 秒自动刷新 · ",
						dataTs ? "行情时间 " + formatClock(dataTs * 1000) + " · " : "",
						state.updatedAt ? "页面更新于 " + formatClock(state.updatedAt) : "等待首次更新"
					),
					h("p", null, "数据来自东方财富公开行情接口，交易时段外显示最近一次报价；仅供参考，不构成投资建议。")
				)
			);

			return h(
				"section",
				{ className: "dgp-page", "data-testid": "gold-price-page", "aria-label": "国内金价" },
				h("div", { className: "dgp-content" }, ...content)
			);
		}

		// ---------------------------------------------------------------------
		// Styles and plugin entry
		// ---------------------------------------------------------------------

		const CSS = `
.dgp-page {
  --dgp-gold: #b8862d;
  --dgp-gold-soft: rgba(184, 134, 45, 0.12);
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  color: var(--dsw-alias-label-primary, #1f2329);
  background: var(--dsw-alias-bg-base, #fff);
  font-size: 14px;
  line-height: 1.6;
  scrollbar-gutter: stable;
}
body[data-ds-dark-theme] .dgp-page {
  --dgp-gold: #e0b15c;
  --dgp-gold-soft: rgba(224, 177, 92, 0.14);
}
.dgp-page *,
.dgp-page *::before,
.dgp-page *::after {
  box-sizing: border-box;
}
.dgp-content {
  max-width: 1040px;
  margin: 0 auto;
  padding: calc(28px + var(--dsh-frame-top-clearance, 0px)) clamp(20px, 4vw, 44px) 56px;
}
.dgp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}
.dgp-heading h1 {
  margin: 0;
  font-size: 23px;
  line-height: 32px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.dgp-heading p {
  margin: 4px 0 0;
  color: var(--dsw-alias-label-tertiary, #8a8f99);
  font-size: 13px;
  line-height: 20px;
}
.dgp-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
  padding-top: 4px;
}
.dgp-live {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l4, #e5e6eb);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1, #f5f6f7);
  color: var(--dsw-alias-label-secondary, #5c6370);
  font-size: 12px;
  white-space: nowrap;
}
.dgp-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-state-success-primary, #2f9e44);
  box-shadow: 0 0 0 3px rgba(47, 158, 68, 0.14);
}
.dgp-live-off .dgp-live-dot {
  background: var(--dsw-alias-label-caption, #b0b4bd);
  box-shadow: none;
}
.dgp-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 0.5px solid var(--dsw-alias-border-l3, #d9dade);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1, #f5f6f7);
  color: var(--dsw-alias-label-primary, #1f2329);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
}
.dgp-button:hover {
  background: var(--dsw-alias-interactive-bg-hover, #eceef1);
}
.dgp-button:active {
  transform: scale(0.98);
}
.dgp-button:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe));
  outline-offset: 2px;
}
.dgp-button-icon {
  display: inline-flex;
  color: var(--dsw-alias-label-secondary, #5c6370);
}
.dgp-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 28px;
  align-items: center;
  padding: 26px 28px;
  border: 0.5px solid var(--dsw-alias-border-l3, #d9dade);
  border-radius: 20px;
  background: radial-gradient(120% 150% at 0% 0%, var(--dgp-gold-soft), transparent 55%),
    var(--dsw-alias-bg-layer-1, #f7f7f8);
  overflow: hidden;
}
.dgp-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--dsw-alias-label-tertiary, #8a8f99);
  font-size: 13px;
}
.dgp-badge {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 5px;
  background: var(--dgp-gold-soft);
  color: var(--dgp-gold);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
}
.dgp-price-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 10px;
}
.dgp-price {
  font-size: clamp(44px, 5.6vw, 62px);
  line-height: 1;
  font-weight: 600;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
}
.dgp-unit {
  color: var(--dsw-alias-label-tertiary, #8a8f99);
  font-size: 14px;
  font-weight: 400;
}
.dgp-change {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  font-size: 14px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.dgp-change-note {
  color: var(--dsw-alias-label-tertiary, #8a8f99);
  font-size: 12px;
  font-weight: 400;
}
.dgp-up {
  color: var(--dsw-alias-state-error-primary, #e5484d);
}
.dgp-down {
  color: var(--dsw-alias-state-success-primary, #2f9e44);
}
.dgp-flat {
  color: var(--dsw-alias-label-secondary, #5c6370);
}
.dgp-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.dgp-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  border: 0.5px solid var(--dsw-alias-border-l4, #e5e6eb);
  border-radius: 14px;
  background: var(--dsw-alias-bg-base, #fff);
}
.dgp-stat-label {
  color: var(--dsw-alias-label-tertiary, #8a8f99);
  font-size: 12px;
  line-height: 18px;
}
.dgp-stat-value {
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.dgp-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}
.dgp-card {
  min-width: 0;
  padding: 18px 20px;
  border: 0.5px solid var(--dsw-alias-border-l3, #d9dade);
  border-radius: 18px;
  background: var(--dsw-alias-bg-layer-1, #f7f7f8);
}
.dgp-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.dgp-card-name {
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
}
.dgp-card-code {
  margin-top: 1px;
  color: var(--dsw-alias-label-caption, #b0b4bd);
  font-size: 11px;
  letter-spacing: 0.04em;
}
.dgp-card-price {
  margin-top: 12px;
  font-size: 28px;
  line-height: 1.15;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.dgp-card-change {
  margin-top: 4px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.dgp-card-meta {
  margin-top: 10px;
  color: var(--dsw-alias-label-caption, #b0b4bd);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.dgp-range {
  position: relative;
  height: 3px;
  margin-top: 10px;
  border-radius: 999px;
  background: var(--dsw-alias-border-l4, #e5e6eb);
}
.dgp-range-dot {
  position: absolute;
  top: 50%;
  width: 7px;
  height: 7px;
  margin-left: -3.5px;
  border-radius: 50%;
  background: var(--dgp-gold);
  box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-1, #f7f7f8);
  transform: translateY(-50%);
}
.dgp-chart-card {
  margin-top: 16px;
  padding: 20px 20px 12px;
}
.dgp-chart-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.dgp-chart-title h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
}
.dgp-chart-title p {
  margin: 2px 0 0;
  color: var(--dsw-alias-label-tertiary, #8a8f99);
  font-size: 12px;
  line-height: 18px;
}
.dgp-chart-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--dsw-alias-label-tertiary, #8a8f99);
  font-size: 11px;
  white-space: nowrap;
}
.dgp-chart-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}
.dgp-chart-facts {
  color: var(--dsw-alias-label-caption, #b0b4bd);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.dgp-legend-line {
  width: 14px;
  height: 2px;
  border-radius: 2px;
  background: var(--dgp-gold);
}
.dgp-legend-dash {
  width: 14px;
  height: 0;
  border-top: 1px dashed var(--dsw-alias-label-caption, #b0b4bd);
}
.dgp-chart-body {
  margin-top: 14px;
}
.dgp-plot {
  position: relative;
  touch-action: none;
}
.dgp-plot svg {
  display: block;
  width: 100%;
  height: 220px;
  overflow: visible;
}
.dgp-axis {
  position: relative;
  height: 22px;
  margin-top: 2px;
  color: var(--dsw-alias-label-caption, #b0b4bd);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.dgp-axis-label {
  position: absolute;
  top: 2px;
  white-space: nowrap;
}
.dgp-axis-start {
  transform: translateX(0);
}
.dgp-axis-middle {
  transform: translateX(-50%);
}
.dgp-axis-end {
  transform: translateX(-100%);
}
.dgp-prev-tag {
  position: absolute;
  right: 2px;
  transform: translateY(-50%);
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-2, #f0f1f3);
  color: var(--dsw-alias-label-tertiary, #8a8f99);
  font-size: 10px;
  line-height: 16px;
  pointer-events: none;
}
.dgp-tooltip {
  position: absolute;
  top: 8px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 7px 10px;
  border: 0.5px solid var(--dsw-alias-border-l3, #d9dade);
  border-radius: 9px;
  background: var(--dsw-alias-bg-base, #fff);
  box-shadow: var(--dsw-elevation-panel, 0 4px 16px rgba(0, 0, 0, 0.08));
  pointer-events: none;
  transform: translateX(-50%);
  white-space: nowrap;
}
.dgp-tooltip-right {
  margin-left: -10px;
  transform: translateX(-100%);
}
.dgp-tooltip-left {
  margin-left: 10px;
  transform: translateX(0);
}
.dgp-tooltip-time {
  color: var(--dsw-alias-label-tertiary, #8a8f99);
  font-size: 10px;
  line-height: 14px;
}
.dgp-tooltip-price {
  font-size: 13px;
  line-height: 18px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.dgp-chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  color: var(--dsw-alias-label-tertiary, #8a8f99);
  font-size: 13px;
}
.dgp-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 14px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--dsw-alias-state-warn-tertiary, #fff4e5);
  color: var(--dsw-alias-state-warn-label, #8a5a00);
  font-size: 12px;
}
.dgp-banner-action {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.dgp-error-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 56px 24px;
  border: 0.5px solid var(--dsw-alias-border-l3, #d9dade);
  border-radius: 20px;
  background: var(--dsw-alias-bg-layer-1, #f7f7f8);
  text-align: center;
}
.dgp-error-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin-bottom: 6px;
  border-radius: 50%;
  background: var(--dgp-gold-soft);
  color: var(--dgp-gold);
}
.dgp-error-card h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}
.dgp-error-card p {
  margin: 0;
  color: var(--dsw-alias-label-tertiary, #8a8f99);
  font-size: 13px;
}
.dgp-error-card .dgp-button {
  margin-top: 14px;
}
.dgp-button-primary {
  border-color: transparent;
  background: var(--dsw-alias-button-primary-fill, #1f2329);
  color: var(--dsw-alias-label-primary-inverted, #fff);
}
.dgp-button-primary:hover {
  background: var(--dsw-alias-button-primary-fill, #1f2329);
  opacity: 0.9;
}
.dgp-skeleton {
  border-radius: 8px;
  background: var(--dsw-alias-bg-skeleton, #eceef1);
  animation: dgp-pulse 1.4s ease-in-out infinite;
}
.dgp-hero-loading {
  align-items: stretch;
}
.dgp-skeleton-eyebrow {
  width: 150px;
  height: 18px;
}
.dgp-skeleton-price {
  width: min(300px, 70%);
  height: 56px;
  margin-top: 12px;
}
.dgp-skeleton-line {
  width: 180px;
  height: 18px;
  margin-top: 14px;
}
.dgp-skeleton-stat-label {
  width: 40px;
  height: 14px;
}
.dgp-skeleton-stat-value {
  width: 70px;
  height: 20px;
  margin-top: 4px;
}
.dgp-skeleton-card-title {
  width: 80px;
  height: 18px;
}
.dgp-skeleton-card-price {
  width: 120px;
  height: 30px;
  margin-top: 16px;
}
.dgp-skeleton-card-line {
  width: 150px;
  height: 14px;
  margin-top: 12px;
}
.dgp-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 18px;
  color: var(--dsw-alias-label-caption, #b0b4bd);
  font-size: 11px;
  line-height: 18px;
}
.dgp-refresh-note {
  color: var(--dsw-alias-label-tertiary, #8a8f99);
}
.dgp-footer p {
  margin: 0;
}
.dgp-spin {
  animation: dgp-spin 0.9s linear infinite;
}
@keyframes dgp-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes dgp-pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 0.9;
  }
}
.dgp-ticker {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  height: 32px;
  margin: 0 0 2px;
  padding: 0 8px;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5c6370);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.dgp-ticker:hover {
  background: var(--dsw-alias-interactive-bg-hover, #eceef1);
}
.dgp-ticker:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe));
  outline-offset: -2px;
}
.dgp-ticker-icon {
  display: inline-flex;
  flex: none;
  color: var(--dgp-gold);
}
.dgp-ticker-label {
  flex: none;
  color: var(--dsw-alias-label-tertiary, #8a8f99);
}
.dgp-ticker-value {
  margin-left: auto;
  color: var(--dsw-alias-label-primary, #1f2329);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.dgp-ticker-pct {
  flex: none;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.dgp-ticker .dgp-up {
  color: var(--dsw-alias-state-error-primary, #e5484d);
}
.dgp-ticker .dgp-down {
  color: var(--dsw-alias-state-success-primary, #2f9e44);
}
.dgp-ticker:not(.dgp-ticker-wide) {
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
}
.dgp-ticker:not(.dgp-ticker-wide) .dgp-ticker-icon {
  color: var(--dsw-alias-label-secondary, #5c6370);
}
@media (max-width: 860px) {
  .dgp-hero {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 22px 20px;
  }
  .dgp-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dgp-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .dgp-content {
    padding-right: 16px;
    padding-bottom: 40px;
    padding-left: 16px;
  }
  .dgp-header {
    flex-direction: column;
    gap: 12px;
  }
  .dgp-toolbar {
    justify-content: space-between;
    width: 100%;
  }
  .dgp-price {
    font-size: 46px;
  }
  .dgp-chart-head {
    flex-direction: column;
    gap: 6px;
  }
  .dgp-chart-legend {
    white-space: normal;
  }
  .dgp-chart-side {
    align-items: flex-start;
  }
  .dgp-plot svg {
    height: 180px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .dgp-spin,
  .dgp-skeleton {
    animation: none;
  }
}
`;

		const STYLE_ID = "dsh-gold-price-style";

		function installStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById(STYLE_ID)) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = CSS;
			document.head.appendChild(style);
		}

		installStyles();

		const inject = ["slots", "layout"];

		function apply(ctx) {
			ctx.slots.inject("main", () =>
				ctx.slots.register(
					{
						name: "main",
						key: PANEL_ID
					},
					GoldPricePage
				)
			);
			ctx.slots.inject("sidebar.panellist", () =>
				ctx.slots.register(
					{
						name: "sidebar.panellist",
						id: PANEL_ID,
						order: 6,
						label: "金价"
					},
					GoldIcon
				)
			);
			ctx.slots.inject("sidebar.footer.action", () =>
				ctx.slots.register(
					{
						name: "sidebar.footer.action",
						id: "gold-price-ticker",
						order: 5
					},
					(props) =>
						h(SidebarGoldTicker, {
							wide: props && props.wide === true,
							onOpen: () => {
								try {
									ctx.layout.selectPanel(PANEL_ID);
								} catch (error) {
									console.error("[gold-price] cannot open panel", error);
								}
							}
						})
				)
			);
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

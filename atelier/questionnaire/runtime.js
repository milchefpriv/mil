export function questionnaireRuntime(input) {
	const firstReady = input.formulas.find((formula) => formula.readyEnabled);
	const firstCustom = input.formulas.find((formula) => formula.customEnabled);
	const state = {
		mode: firstReady ? "ready" : "custom",
		formulaId: "",
		guests: firstReady?.minimum || firstCustom?.minimum || 20,
		selections: {},
		addons: {}
	};
	let stopCompositionTracking = null;
	let modalReturnFocus = null;
	const scrollBehavior = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
	const showModal = (selector) => {
		const modal = document.querySelector(selector);
		if (!modal) return;
		modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		modal.classList.add("show");
		window.requestAnimationFrame(() => modal.querySelector("button, input, textarea, [tabindex]")?.focus());
	};
	const hideModal = (selector) => {
		document.querySelector(selector)?.classList.remove("show");
		modalReturnFocus?.focus();
		modalReturnFocus = null;
	};
	const money = (value) => new Intl.NumberFormat("fr-FR", {
		style: "currency",
		currency: "EUR",
		maximumFractionDigits: 2
	}).format(value || 0);
	const h = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;"
	})[character] || character);
	const category = (id) => input.categories.find((item) => item.id === id) || {
		id,
		label: id,
		short: "Recette",
		color: "#586055"
	};
	const product = (id) => input.products.find((item) => item.id === id);
	const formula = () => input.formulas.find((item) => item.id === state.formulaId);
	const presentation = (item) => item?.presentations?.[state.mode] || {
		name: item?.name || "Formule",
		description: item?.description || "",
		price: item?.price || 0
	};
	const eligibleFormulas = () => input.formulas.filter((item) => state.mode === "ready" ? item.readyEnabled : item.customEnabled);
	const presetSelections = (item) => Object.fromEntries((item?.rules || []).map((rule) => [rule.category, rule.products.filter((config) => config.preset).map((config) => config.id)]));
	const readyEntries = (item) => (item?.rules || []).flatMap((rule) => rule.products.filter((config) => config.preset).map((config) => ({
		rule,
		config,
		item: product(config.id)
	}))).filter((entry) => Boolean(entry.item)).sort((a, b) => {
		return input.categories.findIndex((item) => item.id === a.rule.category) - input.categories.findIndex((item) => item.id === b.rule.category) || String(a.item?.name || "").localeCompare(String(b.item?.name || ""), "fr");
	});
	const formulaVisualEntries = (item) => state.mode === "ready" ? readyEntries(item) : (item?.rules || []).flatMap((rule) => rule.enabled === false ? [] : rule.products.filter((config) => config.enabled !== false).map((config) => ({
		rule,
		config,
		item: product(config.id)
	}))).filter((entry) => Boolean(entry.item));
	const visual = (item, compact = false, eager = false, highPriority = false) => {
		const meta = category(item.category);
		const fallback = "<div class=\"generic theme-" + h(item.visualTheme || "category") + "\" style=\"--tone:" + h(meta.color) + "\"><small>" + h(item.country || "RECETTE") + "</small><b>" + h(meta.short) + "</b></div>";
		const mediaClass = compact ? "media compact" : "media";
		if (item.photo && item.visualMode !== "category") {
			const position = item.photoPositionX + "% " + item.photoPositionY + "%";
			const transform = "scale(" + Math.max(1, item.photoZoom || 1) + ")";
			return "<div class=\"" + mediaClass + "\"><img loading=\"" + (eager ? "eager" : "lazy") + "\" decoding=\"async\"" + (highPriority ? " fetchpriority=\"high\"" : "") + " src=\"" + h(item.photo) + "\" style=\"object-position:" + h(position) + ";transform:" + h(transform) + ";transform-origin:" + h(position) + "\" alt=\"\" onerror=\"this.style.display='none';this.nextElementSibling.style.display='flex'\">" + fallback.replace("class=\"generic", "class=\"generic fallback") + "</div>";
		}
		return "<div class=\"" + mediaClass + "\">" + fallback + "</div>";
	};
	const initializeSelections = () => {
		state.selections = state.mode === "ready" ? presetSelections(formula()) : {};
	};
	const totalHT = () => {
		const current = formula();
		let value = presentation(current).price * state.guests;
		if (state.mode === "custom") current?.rules.forEach((rule) => (state.selections[rule.category] || []).forEach((id) => {
			value += Number(rule.products.find((config) => config.id === id)?.surcharge || 0) * state.guests;
		}));
		Object.entries(state.addons).forEach(([id, quantity]) => {
			const item = product(id);
			if (!item || !quantity) return;
			value += Number(item.price || 0) * quantity * (item.priceMode === "person" ? state.guests : 1);
		});
		return value;
	};
	const totalTTC = () => totalHT() * (1 + input.vat / 100);
	const ttc = (value) => value * (1 + input.vat / 100);
	const ready = () => {
		const current = formula();
		if (!current) return false;
		if (!Number.isFinite(state.guests) || !Number.isInteger(state.guests)) return false;
		if (state.guests < current.minimum) return false;
		if (state.mode === "ready") {
			if (!current.readyEnabled) return false;
			let presetCount = 0;
			return current.rules.every((rule) => {
				const expected = rule.products.filter((config) => config.preset && Boolean(product(config.id))).map((config) => config.id);
				const selected = state.selections[rule.category] || [];
				presetCount += expected.length;
				return selected.length === expected.length && new Set(selected).size === selected.length && selected.every((id) => expected.includes(id));
			}) && presetCount > 0;
		}
		if (!current.customEnabled) return false;
		return current.rules.filter((rule) => rule.enabled !== false).every((rule) => {
			const allowed = new Set(rule.products.filter((config) => config.enabled !== false && Boolean(product(config.id))).map((config) => config.id));
			const selected = state.selections[rule.category] || [];
			return selected.every((id) => allowed.has(id)) && new Set(selected).size === selected.length && (rule.optional ? selected.length <= rule.choices : selected.length === rule.choices);
		});
	};
	const progress = () => {
		const rows = (formula()?.rules || []).filter((rule) => rule.enabled !== false).map((rule) => {
			const selected = Math.min((state.selections[rule.category] || []).length, rule.choices);
			return {
				category: rule.category,
				label: category(rule.category).label,
				selected,
				target: rule.choices,
				optional: rule.optional
			};
		});
		const requiredRows = rows.filter((row) => !row.optional);
		const required = requiredRows.reduce((sum, row) => sum + row.target, 0);
		const selected = requiredRows.reduce((sum, row) => sum + row.selected, 0);
		return {
			rows,
			required,
			selected,
			percent: required ? Math.round(selected / required * 100) : 100
		};
	};
	function selectMode(mode) {
		state.mode = mode;
		state.formulaId = "";
		state.selections = {};
		renderAll();
	}
	function renderModes() {
		document.body.dataset.mode = state.mode;
		const extrasStep = document.querySelector("[data-extras-step]");
		if (extrasStep) extrasStep.textContent = state.mode === "ready" ? "3 · EN PLUS" : "4 · EN PLUS";
		document.querySelectorAll("button[data-mode]").forEach((button) => {
			button.classList.toggle("active", button.dataset.mode === state.mode);
			button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
			button.onclick = () => selectMode(button.dataset.mode);
		});
	}
	function renderFormulas() {
		const target = document.querySelector("#formula-list");
		if (!target) return;
		target.innerHTML = eligibleFormulas().map((item, formulaIndex) => {
			const selected = item.id === state.formulaId;
			const offer = presentation(item);
			const entries = formulaVisualEntries(item);
			const allVisualProducts = entries.map((entry) => entry.item).filter((entry) => Boolean(entry));
			const visualProducts = allVisualProducts.length <= 4 ? allVisualProducts : Array.from({ length: 4 }, (_, index) => allVisualProducts[Math.round(index * (allVisualProducts.length - 1) / 3)]);
			const visualCells = [...visualProducts.map((recipe, imageIndex) => visual(recipe, true, formulaIndex < 3, formulaIndex === 0 && imageIndex === 0)), ...Array.from({ length: Math.max(0, 4 - visualProducts.length) }, () => "<span class=\"formula-gallery-empty\"><i>＋</i></span>")].join("");
			const fixedDetail = selected && state.mode === "ready" ? "<div class=\"ready-formula-detail\"><div class=\"ready-note\"><b>Menu inclus tel quel</b><span>Aucun choix à compléter : cette formule a déjà été équilibrée par notre équipe.</span></div><div class=\"ready-menu-grid\">" + entries.map((entry) => {
				const recipe = entry.item;
				return "<article class=\"product-card ready-recipe-card\">" + visual(recipe, true) + "<div class=\"product-copy\"><small>" + h(category(entry.rule.category).label) + "</small><h4>" + h(recipe.name) + "</h4><footer><span>" + h(entry.config.qty) + " " + h(entry.config.unit) + " / personne</span></footer></div></article>";
			}).join("") + "</div></div>" : "";
			const customDetail = selected && state.mode === "custom" ? "<section class=\"inline-composition\" id=\"composition\" aria-labelledby=\"composition-title\"><div class=\"section-head inline-composition-head\"><div><span class=\"eyebrow\">3 · LA COMPOSITION</span><h2 id=\"composition-title\">Composez " + h(offer.name) + "</h2></div><p id=\"composition-copy\"></p></div><div id=\"composition-list\"></div></section>" : "";
			const quotas = state.mode === "ready" ? entries.slice(0, 4).map((entry) => "<li class=\"formula-dish-title\" style=\"--tone:" + h(category(entry.rule.category).color) + "\">" + h(entry.item.name) + "</li>").join("") + (entries.length > 4 ? "<li class=\"formula-dish-more\">＋ " + (entries.length - 4) + " autres recettes</li>" : "") : item.rules.filter((rule) => rule.enabled !== false && !rule.optional).map((rule) => "<li><b>" + rule.choices + "</b> " + h(category(rule.category).label.toLowerCase()) + "</li>").join("");
			return "<article class=\"formula-shell " + (selected ? "selected" : "") + "\"><button class=\"formula-card\" data-formula=\"" + h(item.id) + "\" aria-pressed=\"" + selected + "\" aria-expanded=\"" + selected + "\"><span class=\"formula-gallery\">" + visualCells + (allVisualProducts.length > 4 ? "<b class=\"formula-gallery-more\">＋" + (allVisualProducts.length - 4) + "</b>" : "") + "</span><span class=\"formula-copy\"><span class=\"formula-kicker\">" + (item.recommended ? "La plus choisie" : state.mode === "ready" ? "Formule prête" : "À composer") + "</span><h3>" + h(offer.name) + "</h3><strong>" + money(ttc(offer.price)) + "<small> TTC / personne</small></strong><p>" + h(offer.description) + "</p><ul>" + quotas + "</ul></span></button>" + fixedDetail + customDetail + "</article>";
		}).join("");
		document.querySelectorAll("[data-formula]").forEach((button) => {
			button.onclick = () => {
				const next = input.formulas.find((item) => item.id === button.dataset.formula);
				if (!next) return;
				if (state.formulaId === next.id) {
					state.formulaId = "";
					state.selections = {};
					renderAll();
					return;
				}
				state.formulaId = next.id;
				state.guests = Math.max(state.guests, next.minimum);
				initializeSelections();
				renderAll();
				[...document.querySelectorAll("[data-formula]")].find((item) => item.dataset.formula === next.id)?.focus({ preventScroll: true });
				window.requestAnimationFrame(() => {
					(state.mode === "custom" ? document.querySelector("#composition") : document.querySelector(".formula-shell.selected .ready-formula-detail"))?.scrollIntoView({
						behavior: scrollBehavior(),
						block: "start"
					});
				});
			};
		});
	}
	function productCard(item, config, selected, blocked, action = "") {
		const tags = item.tags.slice(0, 2).map((id) => input.tags.find((tag) => tag.id === id)?.label).filter(Boolean).map((label) => "<small>" + h(label) + "</small>").join("");
		return "<button class=\"product-card " + (selected ? "selected " : "") + (blocked ? "blocked" : "") + "\" aria-pressed=\"" + selected + "\" " + action + ">" + visual(item, true) + "<div class=\"product-copy\"><h4>" + h(item.name) + "</h4><p>" + h(item.description) + "</p><div class=\"tags\">" + tags + "</div><footer><span>" + h(config.qty) + " " + h(config.unit) + " / pers.</span>" + (config.surcharge ? "<b>+" + money(ttc(config.surcharge)) + " TTC</b>" : "<b>Inclus</b>") + "</footer></div><i>" + (selected ? "✓" : blocked ? "MAX" : "+") + "</i></button>";
	}
	function renderComposition() {
		stopCompositionTracking?.();
		stopCompositionTracking = null;
		const current = formula();
		const target = document.querySelector("#composition-list");
		const heading = document.querySelector("#composition-copy");
		const section = document.querySelector("#composition");
		if (!target) return;
		if (!current) {
			if (section) section.hidden = true;
			target.innerHTML = "";
			return;
		}
		if (state.mode === "ready") {
			if (section) section.hidden = true;
			target.innerHTML = "";
			return;
		}
		if (section) section.hidden = false;
		if (heading) heading.textContent = "Choisissez exactement le nombre de recettes indiqué dans chaque catégorie.";
		const status = progress();
		const currentRow = status.rows.find((row) => !row.optional && row.selected < row.target) || status.rows.find((row) => row.optional && row.selected > 0 && row.selected < row.target) || status.rows[status.rows.length - 1];
		target.innerHTML = "<section class=\"choice-plan " + (status.percent >= 100 ? "complete" : "") + "\"><div class=\"choice-plan-head\"><div><span>VOTRE PROGRESSION</span><b>" + (status.percent >= 100 ? "✓ Composition terminée" : status.selected + " recettes choisies sur " + status.required) + "</b></div><strong>" + status.percent + " %</strong></div><div class=\"choice-plan-track\"><i style=\"width:" + status.percent + "%\"></i></div><div class=\"quota-grid\">" + status.rows.map((row) => "<button type=\"button\" class=\"quota-chip " + (row.selected >= row.target ? "done " : "") + (row.category === currentRow?.category ? "current" : "") + "\" data-quota=\"" + h(row.category) + "\" style=\"--tone:" + h(category(row.category).color) + "\"><span><b>" + h(row.label) + "</b><small>" + (row.optional ? "Facultatif" : "À choisir") + "</small></span><strong>" + row.selected + "/" + row.target + "</strong></button>").join("") + "</div></section>" + current.rules.filter((rule) => rule.enabled !== false).map((rule) => {
			const selected = state.selections[rule.category] || [];
			const meta = category(rule.category);
			const products = rule.products.filter((config) => config.enabled !== false);
			if (!products.length) return "";
			return "<section class=\"choice-group\" data-choice-group=\"" + h(rule.category) + "\" style=\"--tone:" + h(meta.color) + "\"><header><div><i></i><h3>" + h(meta.label) + "</h3></div><b>" + selected.length + " / " + rule.choices + (rule.optional ? " · facultatif" : "") + "</b></header><div class=\"product-grid\">" + products.map((config) => {
				const item = product(config.id);
				if (!item) return "";
				const isSelected = selected.includes(item.id);
				const blocked = selected.length >= rule.choices && !isSelected;
				return productCard(item, config, isSelected, blocked, !blocked ? "data-pick=\"" + h(item.id) + "\" data-category=\"" + h(rule.category) + "\"" : "disabled");
			}).join("") + "</div></section>";
		}).join("");
		const guideElement = target.querySelector(".choice-plan");
		const footerElement = document.querySelector(".footer-order");
		const rail = target.querySelector(".quota-grid");
		const chips = [...target.querySelectorAll("[data-quota]")];
		const groups = [...target.querySelectorAll("[data-choice-group]")];
		if (guideElement && rail && chips.length && groups.length) {
			let activeCategory = "";
			let animationFrame = null;
			const activateCategory = (nextCategory, behavior) => {
				if (!nextCategory || nextCategory === activeCategory) return;
				activeCategory = nextCategory;
				chips.forEach((chip) => {
					const isCurrent = chip.dataset.quota === nextCategory;
					chip.classList.toggle("current", isCurrent);
					if (isCurrent) chip.setAttribute("aria-current", "true");
					else chip.removeAttribute("aria-current");
				});
				const chip = chips.find((item) => item.dataset.quota === nextCategory);
				if (!chip) return;
				rail.scrollTo({
					left: Math.max(0, Math.min(rail.scrollWidth - rail.clientWidth, chip.offsetLeft - (rail.clientWidth - chip.clientWidth) / 2)),
					behavior
				});
			};
			const updateVisibleCategory = (behavior) => {
				const guideBottom = guideElement.getBoundingClientRect().bottom;
				const readingTop = Math.max(0, guideBottom + 12);
				const readingLine = readingTop + (Math.max(readingTop, Math.min(window.innerHeight, (footerElement?.getBoundingClientRect().top ?? window.innerHeight) - 8)) - readingTop) / 2;
				const positionedGroups = groups.map((group) => ({
					group,
					rect: group.getBoundingClientRect()
				}));
				const distanceFromReadingLine = (rect) => readingLine < rect.top ? rect.top - readingLine : readingLine > rect.bottom ? readingLine - rect.bottom : 0;
				activateCategory((positionedGroups.find(({ rect }) => rect.top <= readingLine && rect.bottom > readingLine) || positionedGroups.reduce((closest, positioned) => distanceFromReadingLine(positioned.rect) < distanceFromReadingLine(closest.rect) ? positioned : closest)).group.dataset.choiceGroup || currentRow?.category || "", behavior);
			};
			const scheduleVisibleCategoryUpdate = () => {
				if (animationFrame !== null) return;
				animationFrame = window.requestAnimationFrame(() => {
					animationFrame = null;
					updateVisibleCategory(scrollBehavior());
				});
			};
			window.addEventListener("scroll", scheduleVisibleCategoryUpdate, { passive: true });
			window.addEventListener("resize", scheduleVisibleCategoryUpdate);
			updateVisibleCategory("auto");
			stopCompositionTracking = () => {
				window.removeEventListener("scroll", scheduleVisibleCategoryUpdate);
				window.removeEventListener("resize", scheduleVisibleCategoryUpdate);
				if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
			};
		}
		target.querySelectorAll("[data-quota]").forEach((chip) => {
			chip.onclick = () => target.querySelector("[data-choice-group=\"" + chip.dataset.quota + "\"]")?.scrollIntoView({
				behavior: scrollBehavior(),
				block: "start"
			});
		});
		document.querySelectorAll("[data-pick]").forEach((button) => {
			button.onclick = () => {
				const group = button.dataset.category || "";
				const id = button.dataset.pick || "";
				const rule = current.rules.find((item) => item.category === group);
				if (!rule) return;
				const selected = [...state.selections[group] || []];
				const index = selected.indexOf(id);
				if (index >= 0) selected.splice(index, 1);
				else if (selected.length < rule.choices) selected.push(id);
				else return;
				state.selections[group] = selected;
				renderComposition();
				renderFooter();
				[...document.querySelectorAll("[data-pick]")].find((item) => item.dataset.pick === id && item.dataset.category === group)?.focus();
			};
		});
	}
	function renderAddons() {
		const target = document.querySelector("#addon-list");
		if (!target) return;
		target.innerHTML = input.addonIds.map(product).filter((item) => Boolean(item)).map((item) => {
			const quantity = state.addons[item.id] || 0;
			const priceMode = {
				person: "par personne",
				piece: "par pièce",
				tray: "par plateau",
				flat: "au forfait"
			}[item.priceMode || "piece"] || item.priceMode || "par pièce";
			const priceLabel = item.priceMode === "tray" && Number(item.trayServes) > 0 ? `par plateau de ${item.trayServes} pers.` : priceMode;
			return "<article class=\"addon-card " + (quantity ? "selected" : "") + "\" data-addon-card=\"" + h(item.id) + "\">" + visual(item, true) + "<div><small>" + h(category(item.category).label) + "</small><h3>" + h(item.name) + "</h3><p>" + money(ttc(Number(item.price || 0))) + " " + h(priceLabel) + "</p></div><div class=\"counter\"><button data-addon-minus=\"" + h(item.id) + "\" aria-label=\"Retirer " + h(item.name) + "\">−</button><b aria-live=\"polite\">" + quantity + "</b><button data-addon-plus=\"" + h(item.id) + "\" aria-label=\"Ajouter " + h(item.name) + "\">＋</button></div></article>";
		}).join("");
		document.querySelectorAll("[data-addon-plus]").forEach((button) => {
			button.onclick = (event) => {
				event.stopPropagation();
				changeAddon(button.dataset.addonPlus || "", 1);
			};
		});
		document.querySelectorAll("[data-addon-minus]").forEach((button) => {
			button.onclick = (event) => {
				event.stopPropagation();
				changeAddon(button.dataset.addonMinus || "", -1);
			};
		});
	}
	function changeAddon(id, delta) {
		state.addons[id] = Math.max(0, (state.addons[id] || 0) + delta);
		renderAddons();
		renderFooter();
		const key = delta > 0 ? "addonPlus" : "addonMinus";
		[...document.querySelectorAll(delta > 0 ? "[data-addon-plus]" : "[data-addon-minus]")].find((button) => button.dataset[key] === id)?.focus();
	}
	function renderCart() {
		const target = document.querySelector("#cart-content");
		const countTarget = document.querySelector("#cart-count");
		const nextButton = document.querySelector("[data-action=\"summary-next\"]");
		const current = formula();
		const offer = presentation(current);
		const statusData = progress();
		const rows = (current?.rules || []).flatMap((rule) => (state.selections[rule.category] || []).map((id) => ({
			meta: category(rule.category),
			item: product(id),
			config: rule.products.find((entry) => entry.id === id)
		}))).filter((row) => Boolean(row.item));
		const addonRows = Object.entries(state.addons).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({
			item: product(id),
			quantity
		}));
		const addonGroups = addonRows.length ? "<section class=\"cart-group addons\"><h3>Extras<b>" + addonRows.length + "</b></h3>" + addonRows.map((row) => "<div><span>" + h(row.item?.name) + "</span><small>× " + row.quantity + "</small></div>").join("") + "</section>" : "";
		if (countTarget) countTarget.textContent = String(rows.length + addonRows.length);
		if (nextButton) {
			nextButton.textContent = !current ? "Choisir une formule" : ready() ? "Continuer ma demande →" : "Continuer ma composition";
			nextButton.classList.toggle("complete", ready());
		}
		if (!target) return;
		if (!current) {
			target.innerHTML = "<div class=\"cart-head\"><span>Aucune formule choisie</span><b>" + state.guests + " convives</b></div><section class=\"cart-progress\"><div><span>Avancement</span><b>Choisissez votre formule</b><strong>0 %</strong></div><i><b style=\"width:0%\"></b></i></section><div class=\"cart-empty compact\"><b>Votre commande peut commencer</b><span>Choisissez une formule ; vos choix apparaîtront ici au fur et à mesure.</span></div>" + addonGroups + "<footer><span>Total estimé TTC</span><b>" + money(totalTTC()) + "</b></footer>";
			return;
		}
		const percent = state.mode === "ready" ? 100 : statusData.percent;
		const progressLabel = state.mode === "ready" ? "Formule complète" : ready() ? "Composition terminée" : statusData.selected + " recette" + (statusData.selected === 1 ? "" : "s") + " choisie" + (statusData.selected === 1 ? "" : "s") + " sur " + statusData.required;
		const recipeGroups = input.categories.map((meta) => {
			const group = rows.filter((row) => row.meta.id === meta.id);
			if (!group.length) return "";
			return "<section class=\"cart-group\" style=\"--tone:" + h(meta.color) + "\"><h3>" + h(meta.label) + "<b>" + group.length + "</b></h3>" + group.map((row) => "<div><span>" + h(row.item?.name) + "</span><small>" + h(row.config?.qty) + " " + h(row.config?.unit) + " / pers.</small></div>").join("") + "</section>";
		}).join("");
		target.innerHTML = "<div class=\"cart-head\"><span>" + h(offer.name) + "</span><b>" + state.guests + " convives</b></div><section class=\"cart-progress " + (ready() ? "complete" : "") + "\"><div><span>Avancement</span><b>" + h(progressLabel) + "</b><strong>" + percent + " %</strong></div><i><b style=\"width:" + percent + "%\"></b></i></section>" + (recipeGroups || "<div class=\"cart-empty compact\"><b>Aucune recette choisie</b><span>Vous pouvez revenir compléter votre formule quand vous le souhaitez.</span></div>") + addonGroups + "<footer><span>Total estimé TTC</span><b>" + money(totalTTC()) + "</b></footer>";
	}
	function renderFooter() {
		const current = formula();
		const offer = presentation(current);
		const statusData = progress();
		document.querySelectorAll("#guests").forEach((node) => node.value = String(state.guests));
		document.querySelectorAll("[data-total]").forEach((node) => node.textContent = money(totalTTC()) + " TTC");
		const summaryStatus = document.querySelector("#summary-status");
		const summaryButton = document.querySelector(".order-summary-button");
		if (summaryStatus) summaryStatus.textContent = !current ? "Choisissez une formule" : state.mode === "ready" ? offer.name + " · complète" : ready() ? offer.name + " · terminée" : offer.name + " · " + statusData.selected + "/" + statusData.required + " recettes";
		if (summaryButton) {
			summaryButton.classList.toggle("complete", ready());
			summaryButton.setAttribute("aria-label", "Voir le résumé de ma commande. " + (summaryStatus?.textContent || "Commande en cours"));
		}
		const guestInput = document.querySelector("#guests");
		if (guestInput) {
			guestInput.min = String(current?.minimum || 1);
			guestInput.step = "1";
		}
		renderCart();
	}
	function changeGuests(delta) {
		const minimum = formula()?.minimum || 1;
		state.guests = Math.max(minimum, Math.floor(state.guests + delta));
		renderFooter();
	}
	function advanceOrder() {
		if (!formula()) {
			hideModal("#cart-modal");
			document.querySelector("#formula-list")?.scrollIntoView({
				behavior: scrollBehavior(),
				block: "center"
			});
			return;
		}
		if (!ready()) {
			hideModal("#cart-modal");
			(document.querySelector("#composition") || document.querySelector(".formula-shell.selected"))?.scrollIntoView({
				behavior: scrollBehavior(),
				block: "start"
			});
			return;
		}
		hideModal("#cart-modal");
		showModal("#request-modal");
	}
	function renderAll() {
		renderModes();
		renderFormulas();
		renderComposition();
		renderAddons();
		renderFooter();
	}
	initializeSelections();
	document.querySelectorAll("[data-action=\"guests-minus\"]").forEach((button) => button.onclick = () => changeGuests(-1));
	document.querySelectorAll("[data-action=\"guests-plus\"]").forEach((button) => button.onclick = () => changeGuests(1));
	document.querySelector("#guests")?.addEventListener("change", (event) => {
		const minimum = formula()?.minimum || 1;
		const requested = Number(event.currentTarget.value);
		state.guests = Number.isFinite(requested) ? Math.max(minimum, Math.floor(requested)) : minimum;
		renderFooter();
	});
	document.querySelector("[data-action=\"summary-next\"]").onclick = advanceOrder;
	document.querySelector("[data-action=\"cart\"]").onclick = () => {
		renderCart();
		showModal("#cart-modal");
	};
	document.querySelector("[data-action=\"close-cart\"]").onclick = () => hideModal("#cart-modal");
	document.querySelector("[data-action=\"close-modal\"]").onclick = () => hideModal("#request-modal");
	document.addEventListener("keydown", (event) => {
		if (event.key !== "Escape") return;
		if (document.querySelector("#request-modal.show")) hideModal("#request-modal");
		else if (document.querySelector("#cart-modal.show")) hideModal("#cart-modal");
	});
	let lastRequest = null;
	function printQuote() {
		if (!lastRequest) return;
		const request = lastRequest;
		const client = request.client || {};
		const snapshot = request.snapshot || {};
		const rows = (snapshot.lines || []).map((line) => "<tr><td><small>" + h(line.category) + "</small><b>" + h(line.name) + "</b></td><td>" + (line.quantityPerGuest ? h(line.quantityPerGuest) + " " + h(line.unit) + " / pers." : "—") + "</td><td>" + h(line.quantity) + " " + h(line.unit) + "</td></tr>").join("");
		const quoteWindow = window.open("", "_blank");
		if (!quoteWindow) return;
		quoteWindow.document.write("<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><title>Devis · " + h(client.name) + "</title><style>*{box-sizing:border-box}body{margin:0;background:#e9e6de;color:#191a17;font:14px/1.45 Arial,sans-serif}.page{width:210mm;min-height:297mm;margin:18px auto;padding:18mm;background:#fffefa;box-shadow:0 20px 70px #16171122}.top{display:flex;justify-content:space-between;align-items:start;padding-bottom:14mm;border-bottom:2px solid #191a17}.brand{display:flex;gap:12px;align-items:center}.brand img{width:54px;height:54px;border-radius:12px;object-fit:cover}.brand b{display:block;font-size:18px;letter-spacing:.12em}.brand small,.meta small,.client small,td small{display:block;color:#66736d;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.meta{text-align:right}.meta strong{display:block;font-size:26px}.hero{display:grid;grid-template-columns:1.4fr 1fr;gap:12mm;padding:15mm 0}.hero h1{margin:4px 0;font-size:38px;line-height:1;letter-spacing:-.05em}.hero p{color:#6d7069}.client{padding:14px;border:1px solid #dedbd2;border-radius:12px;background:#f5f2eb}.client b{display:block;margin:5px 0;font-size:17px}.pill{display:inline-block;margin-top:8px;padding:5px 9px;border-radius:99px;background:#e4ede8;color:#355a49;font-size:10px;font-weight:800}table{width:100%;border-collapse:collapse}th{padding:9px 7px;border-bottom:1px solid #cbc7bd;color:#6d7069;font-size:9px;text-align:left;text-transform:uppercase}td{padding:10px 7px;border-bottom:1px solid #e7e3da}td b{display:block}.totals{width:310px;margin:14mm 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:6px 0}.totals .grand{margin-top:5px;padding:12px;border-radius:10px;background:#191a17;color:white;font-size:19px}.terms{margin-top:14mm;padding-top:8mm;border-top:1px solid #d9d5cc;color:#71736c;font-size:10px}.actions{position:fixed;right:20px;bottom:20px}.actions button{padding:13px 18px;border:0;border-radius:9px;background:#191a17;color:white;font-weight:800}@media print{body{background:white}.page{margin:0;box-shadow:none}.actions{display:none}}</style></head><body><main class=\"page\"><header class=\"top\"><div class=\"brand\"><img src=\"" + h(input.logo) + "\" alt=\"\"><div><b>TRAITEUR</b><small>Paris</small></div></div><div class=\"meta\"><small>Devis estimatif</small><strong>" + h(request.id).replace("demande-", "#") + "</strong><span>" + new Date(request.createdAt).toLocaleDateString("fr-FR") + "</span></div></header><section class=\"hero\"><div><small>VOTRE RÉCEPTION</small><h1>" + h(snapshot.formulaName) + "</h1><p>Une proposition préparée pour " + h(snapshot.guests) + " convives. Notre équipe vous recontactera pour confirmer les disponibilités et les derniers détails logistiques.</p><span class=\"pill\">Prix présentés TTC</span></div><div class=\"client\"><small>CLIENT</small><b>" + h(client.name) + "</b><span>" + h(client.email) + "</span><span>" + h(client.phone) + "</span><br><span>" + h(client.date || "Date à confirmer") + " · " + h(client.location || "Lieu à confirmer") + "</span></div></section><table><thead><tr><th>Composition</th><th>Quantité / personne</th><th>Total prévu</th></tr></thead><tbody>" + rows + "</tbody></table><section class=\"totals\"><div><span>Total HT</span><b>" + money(snapshot.totalHT) + "</b></div><div><span>TVA " + h(input.vat) + " %</span><b>" + money(snapshot.vatAmount) + "</b></div><div class=\"grand\"><span>Total TTC</span><b>" + money(snapshot.totalTTC) + "</b></div><div><span>Acompte " + h(input.deposit) + " %</span><b>" + money(snapshot.depositAmount) + "</b></div></section><footer class=\"terms\"><b>Conditions</b><p>" + h(input.terms) + "</p><p>Paiement : " + h(input.paymentMethods) + ".</p></footer></main><div class=\"actions\"><button onclick=\"window.print()\">Imprimer / enregistrer en PDF</button></div></body></html>");
		quoteWindow.document.close();
		quoteWindow.focus();
	}
	document.querySelector("#request-form").onsubmit = async (event) => {
		event.preventDefault();
		const formNode = event.currentTarget;
		if (!(formNode instanceof HTMLFormElement)) return;
		const values = Object.fromEntries(new FormData(formNode).entries());
		const current = formula();
		const offer = presentation(current);
		const formulaLines = current?.rules.flatMap((rule) => (state.selections[rule.category] || []).map((id) => {
			const item = product(id);
			const config = rule.products.find((entry) => entry.id === id);
			return {
				category: category(rule.category).label,
				name: item?.name,
				quantityPerGuest: config?.qty,
				quantity: Number(config?.qty || 0) * state.guests,
				unit: config?.unit
			};
		})) || [];
		const addonUnits = {
			person: "portion",
			piece: "pièce",
			tray: "plateau",
			flat: "forfait"
		};
		const addonLines = Object.entries(state.addons).filter(([, quantity]) => quantity > 0).flatMap(([id, quantity]) => {
			const item = product(id);
			if (!item) return [];
			const perPerson = item.priceMode === "person";
			return [{
				category: "Extra",
				name: item.name,
				quantityPerGuest: perPerson ? quantity : void 0,
				quantity: quantity * (perPerson ? state.guests : 1),
				unit: addonUnits[item.priceMode || "piece"] || "unité"
			}];
		});
		const lines = [...formulaLines, ...addonLines];
		const totalBeforeTax = totalHT();
		const totalWithTax = totalTTC();
		const request = {
			id: "demande-" + Date.now().toString(36),
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			status: "new",
			client: values,
			snapshot: {
				formulaName: offer.name,
				formulaId: current?.id,
				mode: state.mode,
				guests: state.guests,
				selections: state.selections,
				addons: state.addons,
				lines,
				total: totalBeforeTax,
				totalHT: totalBeforeTax,
				vatRate: input.vat,
				vatAmount: totalWithTax - totalBeforeTax,
				totalTTC: totalWithTax,
				depositRate: input.deposit,
				depositAmount: totalWithTax * input.deposit / 100
			}
		};
		const submitButton = formNode.querySelector("button[type=\"submit\"]");
		if (submitButton) {
			submitButton.disabled = true;
			submitButton.textContent = "Envoi en cours…";
		}
		try {
			if (!(await fetch(input.endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json"
				},
				body: JSON.stringify({
					_subject: "Nouvelle demande de devis · " + String(values.name || "Client"),
					prestation: "Cocktail / buffet",
					formule: offer.name,
					mode_composition: state.mode === "ready" ? "Formule déjà composée" : "Formule à composer",
					selection: JSON.stringify(lines || []),
					estimation: money(totalWithTax) + " TTC",
					...request
				})
			})).ok) throw new Error("Envoi refusé");
			await window.milSubmitOrder?.(request);
			lastRequest = request;
			formNode.innerHTML = "<div class=\"success\" role=\"status\"><b>Merci.</b><p>Votre demande a bien été transmise à notre équipe.</p><button class=\"cta\" type=\"button\" data-action=\"print-quote\">Voir et imprimer mon devis</button><small>Le devis s’ouvre dans une version prête à imprimer ou à enregistrer en PDF.</small></div>";
			formNode.querySelector("[data-action=\"print-quote\"]").onclick = printQuote;
		} catch {
			if (submitButton) {
				submitButton.disabled = false;
				submitButton.textContent = "Réessayer l’envoi";
			}
			let error = formNode.querySelector(".form-error");
			if (!error) {
				error = document.createElement("p");
				error.className = "form-error";
				error.setAttribute("role", "alert");
				formNode.appendChild(error);
			}
			error.textContent = "L’envoi n’a pas abouti. Vérifiez votre connexion puis réessayez : aucune donnée n’a été perdue.";
		}
	};
	renderAll();
}

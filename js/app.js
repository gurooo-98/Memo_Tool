const WEEK_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const FILE_COLLECTIONS = ["todos", "schedules", "issues"];
let dataDirectoryHandle = null;

/** 저장 폴더가 연결되기 전에는 빈 데이터 상태로 시작합니다. */
function loadData() { return { schedules: [], issues: [], todos: [] }; }

/** 생성 또는 수정된 항목 하나만 해당 JSON 파일에 저장합니다. */
async function saveRecord(collection, record) {
	try {
		const directory = await dataDirectoryHandle.getDirectoryHandle(collection, { create: true });
		await writeJsonFile(directory, `${record.id}.json`, record);
		setFolderStatus("파일 저장 완료");
	} catch { setFolderStatus("파일 저장 실패"); }
}

/** 삭제된 항목 하나에 대응하는 JSON 파일만 폴더에서 제거합니다. */
async function deleteRecord(collection, id) {
	try {
		const directory = await dataDirectoryHandle.getDirectoryHandle(collection, { create: true });
		await directory.removeEntry(`${id}.json`);
		setFolderStatus("파일 삭제 완료");
	} catch (error) { if (error.name !== "NotFoundError") setFolderStatus("파일 삭제 실패"); }
}

/** 항목 하나를 사람이 읽을 수 있게 들여쓴 JSON 파일로 작성합니다. */
async function writeJsonFile(directory, name, record) {
	const fileHandle = await directory.getFileHandle(name, { create: true });
	const writable = await fileHandle.createWritable();
	await writable.write(JSON.stringify(record, null, "\t"));
	await writable.close();
}

/** 선택한 폴더의 개별 JSON 파일을 모두 읽어 앱 데이터로 만듭니다. */
async function readFolderData(directory) {
	const result = { todos: [], schedules: [], issues: [] };
	for (const collection of FILE_COLLECTIONS) {
		const itemDirectory = await directory.getDirectoryHandle(collection, { create: true });
		for await (const [name, handle] of itemDirectory.entries()) {
			if (handle.kind !== "file" || !name.endsWith(".json")) continue;
			try { result[collection].push(JSON.parse(await (await handle.getFile()).text())); } catch { /* 손상된 파일은 건너뜁니다. */ }
		}
	}
	return result;
}

/** 사용자가 저장할 상위 폴더를 선택하면 Memo_Tool_Data 폴더를 준비합니다. */
async function chooseDataFolder() {
	if (!("showDirectoryPicker" in window)) { alert("이 기능은 Chrome 또는 Edge 브라우저에서 사용할 수 있습니다."); return; }
	try {
		const selectedDirectory = await window.showDirectoryPicker({ mode: "readwrite" });
		dataDirectoryHandle = await selectedDirectory.getDirectoryHandle("Memo_Tool_Data", { create: true });
		const fileData = await readFolderData(dataDirectoryHandle);
		if (Object.values(fileData).some(records => records.length)) { data.todos = fileData.todos; data.schedules = fileData.schedules; data.issues = fileData.issues; }
		setFolderStatus(`연결됨: ${dataDirectoryHandle.name}`);
		$("#storageGate").hidden = true;
		render();
	} catch (error) { if (error.name !== "AbortError") setFolderStatus("폴더 연결 실패"); }
}

/** 메뉴에 현재 파일 저장 연결 상태를 보여줍니다. */
function setFolderStatus(message) { const status = document.querySelector("#folderStatus"); if (status) status.textContent = message; }

/** 날짜를 시간 정보 없이 비교할 수 있는 YYYY-MM-DD 문자열로 만듭니다. */
function toDateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

/** YYYYMMDD 숫자 입력을 저장용 YYYY-MM-DD 날짜로 변환하고 유효성을 확인합니다. */
function parseNumericDate(value) {
	const digits = value.replace(/\D/g, "");
	if (!/^\d{8}$/.test(digits)) return null;
	const year = Number(digits.slice(0, 4));
	const month = Number(digits.slice(4, 6));
	const day = Number(digits.slice(6, 8));
	const date = new Date(year, month - 1, day);
	if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
	return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/** 저장된 YYYY-MM-DD 날짜를 폼용 숫자 YYYYMMDD로 변환합니다. */
function toNumericDate(dateKey) { return dateKey.replaceAll("-", ""); }

/** 등록 창에 현재 항목의 고유 ID를 작게 표시합니다. */
function showRecordId(labelSelector, id) { $(labelSelector).textContent = `ID: ${id}`; }

/** 색상 팔레트에서 선택된 색을 저장하고 선택 상태를 화면에 표시합니다. */
function selectScheduleColor(color) {
	$("#scheduleColor").value = color;
	document.querySelectorAll(".color-option").forEach(button => {
		const selected = button.dataset.color === color;
		button.classList.toggle("selected", selected);
	button.setAttribute("aria-checked", selected);
	});
}

/** 현재 선택된 달의 6주 × 7일 격자와 그 안의 일정 막대를 그립니다. */
function renderCalendar(container, viewDate, schedules, onScheduleClick, onDayClick) {
	const year = viewDate.getFullYear();
	const month = viewDate.getMonth();
	const firstDay = new Date(year, month, 1);
	const start = new Date(year, month, 1 - firstDay.getDay());
	const gridEnd = new Date(start); gridEnd.setDate(start.getDate() + 41);
	const today = toDateKey(new Date());
	container.innerHTML = "";
	for (let index = 0;
	index < 42;
	index += 1) {
		const date = new Date(start); date.setDate(start.getDate() + index);
		const key = toDateKey(date);
	const cell = document.createElement("div");
		cell.className = `day-cell ${date.getMonth() !== month ? "outside" : ""} ${date.getDay() === 0 ? "sunday" : ""} ${key === today ? "today" : ""}`;
		cell.innerHTML = `<span class="day-number" title="${WEEK_NAMES[date.getDay()]}요일">${date.getDate()}</span>`;
		cell.addEventListener("click", () => onDayClick(key));
		container.append(cell);
	}
	const layer = document.createElement("div"); layer.className = "schedule-layer";
	const visibleSchedules = schedules.filter(item => item.end >= toDateKey(start) && item.start <= toDateKey(gridEnd));
	const lanes = [];
	[...visibleSchedules].sort((a, b) => a.start.localeCompare(b.start)).forEach(item => {
		const lane = lanes.findIndex(end => end < item.start);
	const laneIndex = lane === -1 ? lanes.length : lane;
		lanes[laneIndex] = item.end;
		const clippedStart = item.start < toDateKey(start) ? toDateKey(start) : item.start;
		const clippedEnd = item.end > toDateKey(gridEnd) ? toDateKey(gridEnd) : item.end;
		const startDate = new Date(`${clippedStart}T00:00:00`);
	const endDate = new Date(`${clippedEnd}T00:00:00`);
		for (let segmentStart = new Date(startDate); segmentStart <= endDate; segmentStart.setDate(segmentStart.getDate() + 7 - segmentStart.getDay())) {
			const segmentEnd = new Date(Math.min(endDate, new Date(segmentStart.getFullYear(), segmentStart.getMonth(), segmentStart.getDate() + 6 - segmentStart.getDay())));
			const gridRow = Math.floor((segmentStart - start) / 86400000 / 7) + 1;
	const gridColumn = segmentStart.getDay() + 1;
			const span = Math.round((segmentEnd - segmentStart) / 86400000) + 1;
			const bar = document.createElement("button");
	bar.type = "button";
	bar.className = `schedule-bar ${item.color}`;
	bar.textContent = item.title;
			bar.style.gridColumn = `${gridColumn} / span ${span}`;
	bar.style.gridRow = gridRow;
	bar.style.setProperty("--lane", laneIndex);
			bar.addEventListener("click", event => { event.stopPropagation(); onScheduleClick(item); }); layer.append(bar);
		}
	});
	container.append(layer);
}

/** 이슈 현황 숫자와 필터에 맞는 이슈 목록을 표시합니다. */
function renderIssues(statsContainer, listContainer, issues, filter, search, onIssueClick) {
	const open = issues.filter(issue => !issue.resolved).length;
	statsContainer.innerHTML = `<div class="stat-card"><span>진행 중 이슈</span><strong>${open}</strong></div><div class="stat-card"><span>해결 완료</span><strong>${issues.length - open}</strong></div>`;
	const titleQuery = search.title.trim().toLowerCase();
	const tagQuery = search.tag.trim().toUpperCase();
	const visible = issues.filter(issue => {
		const matchesStatus = filter === "all" || (filter === "resolved" ? issue.resolved : !issue.resolved);
		const matchesTitle = !titleQuery || issue.title.toLowerCase().includes(titleQuery);
		const matchesTag = !tagQuery || (issue.tags || []).some(tag => tag.includes(tagQuery.startsWith("#") ? tagQuery : `#${tagQuery}`));
		return matchesStatus && matchesTitle && matchesTag;
	}).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
	listContainer.innerHTML = "";
	if (!visible.length) { listContainer.innerHTML = `<p class="empty-state">조건에 맞는 이슈가 없습니다.</p>`;
	return; }
	visible.forEach(issue => {
		const card = document.createElement("article"); card.className = `issue-card ${issue.priority} ${issue.resolved ? "resolved" : ""}`;
		const tags = (issue.tags || []).map(tag => `<span class="issue-tag">${escapeHtml(tag)}</span>`).join("");
		card.innerHTML = `<p class="issue-title">${escapeHtml(issue.title)}</p><div class="issue-tags">${tags}</div>`;
		card.addEventListener("click", () => onIssueClick(issue));
	listContainer.append(card);
	});
}

function priorityLabel(priority) { return ({ high: "HIGH", medium: "MEDIUM", low: "LOW" })[priority]; }
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value;
	return div.innerHTML; }

/** 저장된 등록 시각을 읽기 쉬운 날짜와 시간으로 표시합니다. */
function formatCreatedAt(value) {
	if (!value) return "등록 시각 없음";
	return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

/** 태그별 TODO 목록을 그리고 완료 상태를 즉시 저장합니다. */
function renderTodos(container, todos) {
	const groups = [
		{ key: "now", label: "NOW", description: "오늘 해내기" },
		{ key: "next", label: "NEXT UP", description: "한 달 안에" },
		{ key: "someday", label: "SOMEDAY", description: "시간 날 때" },
	];
	container.innerHTML = "";

	groups.forEach(group => {
		const items = todos.filter(todo => todo.tag === group.key && !todo.done);
		const section = document.createElement("section");
		section.className = `todo-group ${group.key}`;
		section.innerHTML = `<div class="todo-group-heading"><div><h2>${group.label}</h2><p>${group.description}</p></div><span>${items.length}</span></div>`;
		const list = document.createElement("div");
		list.className = "todo-list";

		if (!items.length) list.innerHTML = `<p class="todo-empty">등록된 TODO가 없습니다.</p>`;
		items.forEach(todo => {
			const row = document.createElement("article");
			row.className = "todo-item";
			row.innerHTML = `<button class="todo-check" type="button" aria-label="TODO 완료"></button><div><p>${escapeHtml(todo.title)}</p>${todo.note ? `<span>${escapeHtml(todo.note)}</span>` : ""}</div>`;
			row.querySelector(".todo-check").addEventListener("click", async event => { event.stopPropagation(); todo.done = true; await saveRecord("todos", todo); render(); });
			row.addEventListener("click", () => openTodo(todo));
			list.append(row);
		});
		section.append(list);
		container.append(section);
	});

	const completed = todos.filter(todo => todo.done);
	const completedSection = document.createElement("section");
	completedSection.className = "completed-todos";
	completedSection.innerHTML = `<div class="completed-heading"><div><p class="eyebrow">COMPLETED</p><h2>완료 TODO 관리</h2></div><span>${completed.length}</span></div>`;
	const completedList = document.createElement("div");
	completedList.className = "completed-list";
	if (!completed.length) completedList.innerHTML = `<p class="todo-empty">완료한 TODO가 여기에 보입니다.</p>`;

	completed.forEach(todo => {
		const row = document.createElement("article");
		row.className = "completed-todo-item";
		row.innerHTML = `<button class="todo-check" type="button" aria-label="TODO 다시 열기">✓</button><div><p>${escapeHtml(todo.title)}</p>${todo.note ? `<span>${escapeHtml(todo.note)}</span>` : ""}<time>${formatCreatedAt(todo.createdAt)}</time></div><span class="completed-tag ${todo.tag}">${({ now: "NOW", next: "NEXT UP", someday: "SOMEDAY" })[todo.tag]}</span>`;
		row.querySelector(".todo-check").addEventListener("click", async event => {
			event.stopPropagation();
			todo.done = false;
			await saveRecord("todos", todo);
			render();
		});
		row.addEventListener("click", () => openTodo(todo));
		completedList.append(row);
	});
	completedSection.append(completedList);
	container.append(completedSection);
}

const data = loadData();
	let viewDate = new Date();
	let issueFilter = "all";
const issueSearch = { title: "", tag: "" };
const $ = selector => document.querySelector(selector);
const calendarGrid = $("#calendarGrid");

/** 변경된 데이터를 저장하고 모든 화면 요소를 최신 상태로 다시 그립니다. */
function render() {
	$("#calendarTitle").textContent = `${viewDate.getFullYear()}년 ${viewDate.getMonth() + 1}월`;
	$("#todayLabel").textContent = new Intl.DateTimeFormat("ko-KR", { month:"long", day:"numeric", weekday:"short" }).format(new Date());
	$("#summaryCount").textContent = data.todos.filter(item => !item.done && item.tag === "now").length;
	renderTodos($("#todoGroups"), data.todos);
	renderCalendar(calendarGrid, viewDate, data.schedules, openSchedule, date => openSchedule(null, date));
	renderIssues($("#issueStats"), $("#issueList"), data.issues, issueFilter, issueSearch, openIssue);
}

/** 일정 모달을 신규 등록 또는 기존 일정 편집 상태로 엽니다. */
function openSchedule(item = null, initialDate = toDateKey(new Date())) {
	$("#scheduleForm").reset();
	const id = item?.id || crypto.randomUUID();
	$("#scheduleId").value = id;
	showRecordId("#scheduleIdLabel", id);
	$("#scheduleModalTitle").textContent = item ? "일정 수정" : "새 일정 등록";
	$("#scheduleTitle").value = item?.title || "";
	$("#scheduleStart").value = toNumericDate(item?.start || initialDate);
	$("#scheduleEnd").value = toNumericDate(item?.end || initialDate); selectScheduleColor(item?.color || "orange");
	$("#scheduleNote").value = item?.note || "";
	$("#deleteSchedule").classList.toggle("hidden", !item);
	showModal("scheduleModal");
}

/** 이슈 전용 작성 화면을 열고 제목·태그·본문을 표시합니다. */
function openIssue(item = null) {
	$("#issueEditorForm").reset();
	const id = item?.id || crypto.randomUUID();
	$("#editorIssueId").value = id;
	showRecordId("#editorIssueIdLabel", id);
	$("#editorIssueTitle").value = item?.title || "";
	$("#editorIssueTags").value = (item?.tags || []).join(" ");
	$("#editorIssueContent").value = item?.content || item?.description || "";
	$("#editorIssueResolved").checked = item?.resolved || false;
	$("#deleteEditorIssue").classList.toggle("hidden", !item);
	selectView("issueEditor");
}

/** 모든 최신 브라우저에서 동작하는 자체 모달을 표시합니다. */
function showModal(id) { const modal = $(`#${id}`);
	modal.hidden = false;
	modal.setAttribute("aria-hidden", "false"); }

/** 열린 모달을 숨기고 접근성 상태를 갱신합니다. */
function closeModal(id) { const modal = $(`#${id}`);
	modal.hidden = true;
	modal.setAttribute("aria-hidden", "true"); }

/** TODO 태그 선택 상태를 갱신합니다. */
function selectTodoTag(tag) { $("#todoTag").value = tag;
	document.querySelectorAll(".todo-tag").forEach(button => button.classList.toggle("selected", button.dataset.todoTag === tag)); }

/** TODO 등록 또는 수정 모달을 열고 기존 값을 폼에 표시합니다. */
function openTodo(todo = null) {
	$("#todoForm").reset();
	const id = todo?.id || crypto.randomUUID();
	$("#todoId").value = id;
	showRecordId("#todoIdLabel", id);
	$("#todoModalTitle").textContent = todo ? "TODO 수정" : "새 TODO 등록";
	$("#todoTitle").value = todo?.title || "";
	$("#todoNote").value = todo?.note || "";
	selectTodoTag(todo?.tag || "now");
	$("#deleteTodo").classList.toggle("hidden", !todo);
	$("#saveTodo").textContent = todo ? "저장하기" : "등록하기";
	showModal("todoModal");
}

/** 좌측 메뉴에서 선택한 화면만 표시하고 메뉴의 선택 상태를 갱신합니다. */
function selectView(viewId) {
	document.querySelectorAll(".view-panel").forEach(panel => { const active = panel.id === viewId; panel.hidden = !active; panel.classList.toggle("active", active); });
	const activeMenuId = viewId === "issueEditor" ? "issues" : viewId;
	document.querySelectorAll(".menu-item").forEach(button => button.classList.toggle("active", button.dataset.view === activeMenuId));
	const action = $("#primaryAction");
	action.hidden = viewId === "issues" || viewId === "issueEditor";
	action.textContent = viewId === "calendar" ? "+ 새 일정" : "+ 새 TODO";
	closeMenu();
}

/** 좌측 메뉴를 표시합니다. */
function openMenu() { $("#sideMenu").hidden = false;
	$("#menuDim").hidden = false;
	$("#menuToggle").setAttribute("aria-expanded", "true"); }

/** 좌측 메뉴와 배경 딤을 숨깁니다. */
function closeMenu() { $("#sideMenu").hidden = true;
	$("#menuDim").hidden = true;
	$("#menuToggle").setAttribute("aria-expanded", "false"); }

$("#primaryAction").addEventListener("click", () => { if ($("#calendar").hidden) openTodo(); else openSchedule(); });
$("#openIssueModal").addEventListener("click", () => openIssue());
$("#backToIssues").addEventListener("click", () => selectView("issues"));
$("#menuToggle").addEventListener("click", openMenu);
	$("#chooseDataFolder").addEventListener("click", chooseDataFolder);
	$("#connectStorageFirst").addEventListener("click", chooseDataFolder);
	$("#closeMenu").addEventListener("click", closeMenu);
	$("#menuDim").addEventListener("click", closeMenu);
document.querySelectorAll(".menu-item").forEach(button => button.addEventListener("click", () => selectView(button.dataset.view)));
$("#previousMonth").addEventListener("click", () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
	render(); });
$("#nextMonth").addEventListener("click", () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
	render(); });
$("#goToday").addEventListener("click", () => { viewDate = new Date();
	render(); });
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => closeModal(button.dataset.close)));
$("#issueFilters").addEventListener("click", event => { const button = event.target.closest("[data-filter]");
	if (!button) return; issueFilter = button.dataset.filter;
	document.querySelectorAll(".filter").forEach(item => item.classList.toggle("active", item === button));
	render(); });
$("#issueTitleSearch").addEventListener("input", event => { issueSearch.title = event.target.value; render(); });
$("#issueTagFilter").addEventListener("input", event => { issueSearch.tag = event.target.value; render(); });
document.querySelectorAll("#scheduleStart, #scheduleEnd").forEach(input => input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, ""); }));
document.querySelectorAll(".color-option").forEach(button => button.addEventListener("click", () => selectScheduleColor(button.dataset.color)));
document.querySelectorAll(".todo-tag").forEach(button => button.addEventListener("click", () => selectTodoTag(button.dataset.todoTag)));

/** 입력한 TODO를 현재 선택 태그로 저장합니다. */
$("#todoForm").addEventListener("submit", async event => { event.preventDefault();
	const id = $("#todoId").value;
	const previous = data.todos.find(todo => todo.id === id);
	const todo = { id: id || crypto.randomUUID(), title: $("#todoTitle").value.trim(), tag: $("#todoTag").value, note: $("#todoNote").value.trim(), createdAt: previous?.createdAt || new Date().toISOString(), done: previous?.done || false };
	const index = data.todos.findIndex(item => item.id === id);
	index < 0 ? data.todos.push(todo) : data.todos[index] = todo;
	await saveRecord("todos", todo);
	closeModal("todoModal");
	render(); });
$("#deleteTodo").addEventListener("click", async () => { const id = $("#todoId").value; data.todos = data.todos.filter(todo => todo.id !== id); await deleteRecord("todos", id); closeModal("todoModal"); render(); });

/** 폼 입력값으로 일정을 새로 추가하거나 기존 항목을 갱신합니다. */
$("#scheduleForm").addEventListener("submit", async event => { event.preventDefault();
	const start = parseNumericDate($("#scheduleStart").value);
	const end = parseNumericDate($("#scheduleEnd").value);
	if (!start || !end) { alert("시작일과 종료일을 YYYYMMDD 형식의 숫자 8자리로 입력해주세요.");
	return; } if (end < start) { alert("종료일은 시작일보다 빠를 수 없습니다.");
	return; } const id = $("#scheduleId").value;
	const item = { id: id || crypto.randomUUID(), title: $("#scheduleTitle").value.trim(), start, end, color: $("#scheduleColor").value, note: $("#scheduleNote").value.trim() };
	const index = data.schedules.findIndex(schedule => schedule.id === id);
	index < 0 ? data.schedules.push(item) : data.schedules[index] = item;
	await saveRecord("schedules", item);
	closeModal("scheduleModal");
	render(); });
$("#deleteSchedule").addEventListener("click", async () => { const id = $("#scheduleId").value;
	data.schedules = data.schedules.filter(item => item.id !== id);
	await deleteRecord("schedules", id);
	closeModal("scheduleModal");
	render(); });

/** 폼 입력값으로 이슈를 새로 추가하거나 기존 항목을 갱신합니다. */
$("#issueForm").addEventListener("submit", async event => { event.preventDefault();
	const id = $("#issueId").value;
	const item = { id: id || crypto.randomUUID(), title: $("#issueTitle").value.trim(), date: $("#issueDate").value, priority: $("#issuePriority").value, description: $("#issueDescription").value.trim(), resolved: $("#issueResolved").checked };
	const index = data.issues.findIndex(issue => issue.id === id);
	index < 0 ? data.issues.push(item) : data.issues[index] = item;
	await saveRecord("issues", item);
	closeModal("issueModal");
	render(); });
$("#deleteIssue").addEventListener("click", async () => { const id = $("#issueId").value;
	data.issues = data.issues.filter(item => item.id !== id);
	await deleteRecord("issues", id);
	closeModal("issueModal");
	render(); });

/** 제목·자유 태그·본문을 포함한 이슈 메모를 저장합니다. */
$("#issueEditorForm").addEventListener("submit", async event => {
	event.preventDefault();
	const id = $("#editorIssueId").value;
	const previous = data.issues.find(issue => issue.id === id);
	const tags = [...new Set($("#editorIssueTags").value.trim().split(/\s+/).filter(Boolean).map(tag => tag.startsWith("#") ? tag.toUpperCase() : `#${tag.toUpperCase()}`))];
	const issue = {
		id: id || crypto.randomUUID(),
		title: $("#editorIssueTitle").value.trim(),
		tags,
		content: $("#editorIssueContent").value.trim(),
		priority: previous?.priority || "medium",
		resolved: $("#editorIssueResolved").checked,
	};
	const index = data.issues.findIndex(item => item.id === id);
	index < 0 ? data.issues.push(issue) : data.issues[index] = issue;
	await saveRecord("issues", issue);
	selectView("issues");
	render();
});
$("#deleteEditorIssue").addEventListener("click", async () => {
	const id = $("#editorIssueId").value;
	data.issues = data.issues.filter(issue => issue.id !== id);
	await deleteRecord("issues", id);
	selectView("issues");
	render();
});
render();

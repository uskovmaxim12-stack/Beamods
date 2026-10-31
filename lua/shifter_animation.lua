local M = {}

local v = 0
local target = 0
local holdTimer = 0
local delay = 0.16
local speed = 10
local lastState = nil

local function getElectrics()
if not electrics or not electrics.values then return nil end
return electrics.values
end

local function pulse(x)
target = x
holdTimer = delay
end

local function readState()
local e = getElectrics()
if not e then return nil end

local g = e.gear
if type(g) == "string" then
g = string.upper(g)
if g == "R" then return "R" end
if g == "N" then return "N" end
if g == "P" then return "P" end
if g == "D" or string.sub(g, 1, 1) == "D" then return "D" end
if tonumber(g) then
local n = tonumber(g)
if n < 0 then return "R" end
if n == 0 then return "N" end
if n > 0 then return "D" end
end
end

local gi = e.gearIndex
if type(gi) == "number" then
if gi < 0 then return "R" end
if gi > 0 then return "D" end
return nil
end

return nil
end

local function handleTransition(prev, cur)
if not prev or not cur or prev == cur then return end

if prev == "P" and cur == "R" then
pulse(-1)

elseif prev == "N" and cur == "D" then
pulse(1)

elseif prev == "D" and cur == "N" then
pulse(-1)

elseif prev == "N" and cur == "R" then
pulse(-1)

elseif prev == "R" and cur == "N" then
pulse(1)

else
target = 0
holdTimer = 0
end
end

local function updateGFX(dt)
local e = getElectrics()
if not e then return end

local cur = readState()

if lastState == nil then
lastState = cur
end

if cur ~= lastState then
handleTransition(lastState, cur)
lastState = cur
end

if holdTimer > 0 then
holdTimer = holdTimer - dt
if holdTimer <= 0 then
holdTimer = 0
target = 0
end
end

local step = math.min(dt * speed, 1)
v = v + (target - v) * step
e.shifterPulse = v
end

local function init()
v = 0
target = 0
holdTimer = 0
lastState = nil
local e = getElectrics()
if e then
e.shifterPulse = 0
end
end

local function reset()
init()
end

local function onExtensionLoaded()
init()
end

M.reset = reset
M.updateGFX = updateGFX
M.onExtensionLoaded = onExtensionLoaded

return M
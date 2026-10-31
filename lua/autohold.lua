--author ACM | BEAMNG for Rivian R1 S/T Kenemation Mods

local M = {}
local timer = 0

local function onInit()
electrics.values.autoholdTrigger = 1
timer = 0
end

local function onReset()
electrics.values.autoholdTrigger = 1
timer = 0
end 

local function updateGFX(dt)
	local rot = quat(obj:getRotation()):toEulerYXZ()
	local roll, pitch, yaw = rot.z, rot.y, rot.x
	local pitch = pitch * (180 / 3.14)
	local pitchabs = math.abs(pitch)
    if electrics.values.ignitionLevel >= 1 and electrics.values.airspeed <= 3 / 3.6 and electrics.values.autoholdTrigger == 1 then
		if electrics.values.brake >= 0.05 then
			timer = timer + dt
			if timer >= 0.3 then
				electrics.values.autohold = 1
				electrics.values.autoholdInd = 1
			end
		end
		if electrics.values.autohold == 1 then
			if electrics.values.throttle <= 0.05 and pitch > 10 then
				electrics.values.brake = 0.6 + electrics.values.brake
			elseif electrics.values.throttle <= 0.02 and pitch > 5 then
				electrics.values.brake = 0.4 + electrics.values.brake
			else
				if electrics.values.throttle <= 0.0 and pitchabs > 15 then 
					electrics.values.brake = 0.6 + electrics.values.brake
				elseif electrics.values.throttle <= 0.0 and pitchabs > 5 then 
					electrics.values.brake = 0.4 + electrics.values.brake
				elseif electrics.values.throttle <= 0.0 and pitchabs > 0 then 
					electrics.values.brake = 0.15 + electrics.values.brake
				end
			end
		end
	else
		electrics.values.brake = electrics.values.brake
		electrics.values.autohold = 0
		timer = 0
	end
	if electrics.values.ignitionLevel >= 1 and electrics.values.autoholdTrigger == 1 then
		electrics.values.autoholdInd = 1
	else
		electrics.values.autoholdInd = 0
	end
end

-- public interface

M.onInit      = onInit
M.onReset     = onInit
M.updateGFX = updateGFX

return M
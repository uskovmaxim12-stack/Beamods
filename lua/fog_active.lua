--author ACM | BEAMNG for Rivian R1 S/T Kenemation Mods

local M = {}

local function resetFog()
    electrics.values.fog_L = 0
    electrics.values.fog_R = 0
end

local function updateGFX(dt)
    local ignition = electrics.values.ignitionLevel or 0
    local wheelspeed = electrics.values.wheelspeed or 0
    local steering = electrics.values.steering or 0
    local fog = electrics.values.fog or 0
    local speedLimit = 45 / 3.6
    local minSteerSpeed = 5 / 3.6

    if ignition >= 1 then
        local steerAllowed = wheelspeed >= minSteerSpeed and wheelspeed <= speedLimit

        electrics.values.fog_L = ((steerAllowed and steering > 125) or fog == 1) and 1 or 0
        electrics.values.fog_R = ((steerAllowed and steering < -125) or fog == 1) and 1 or 0
    else
        resetFog()
    end
end

M.updateGFX = updateGFX
M.onInit = resetFog
M.onReset = resetFog

return M

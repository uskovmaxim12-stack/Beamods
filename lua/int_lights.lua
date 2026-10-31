--author ACM | BEAMNG for Rivian R1 S/T Kenemation Mods

local M = {}
local timer_F = 0
local timer_R = 0
local timer_T = 0
local timer_TR = 0
local delay = 2.5

local function R()
    electrics.values.lamp_main = 0
    electrics.values.lamp_rl = 0
    electrics.values.lamp_rr = 0
    electrics.values.lamp_tunnel = 0
    electrics.values.lamp_trunk = 0
    electrics.values.lamp_frunk = 0
    timer_F = -1
    timer_R = -1
    timer_TR = -1
    timer_T = 0
end 

local function updateGFX(dt)
    if electrics.values.ignitionLevel >= 1 then
        local anyFrontDoorOpen = electrics.values.doorFLCoupler_notAttached == 1 or electrics.values.doorFRCoupler_notAttached == 1
        local anyRearDoorOpen = electrics.values.doorRLCoupler_notAttached == 1 or electrics.values.doorRRCoupler_notAttached == 1
        local anyTailgateOpen = electrics.values.tailgateCoupler_notAttached == 1
        local anyHoodOpen = electrics.values.hoodCatchCoupler_notAttached == 1
        local anyTunnelHatchOpen = electrics.values.tunnelCouplerL_notAttached == 1 or electrics.values.tunnelCouplerR_notAttached == 1
        local mainTrigger = electrics.values.tlamp_main == 1
        
        if timer_F >= 0 then
            if anyFrontDoorOpen then
                timer_F = delay
            else
                timer_F = timer_F - dt
            end
        end
        
        if timer_R >= 0 then
            if anyRearDoorOpen then
                timer_R = delay 
            else
                timer_R = timer_R - dt
            end
        end
		
		if timer_TR >= 0 then
            if anyTailgateOpen then
                timer_TR = delay 
            else
                timer_TR = timer_TR - dt
            end
        end
        
        if anyFrontDoorOpen or mainTrigger or (timer_F > 0 and timer_F <= delay) then 
            electrics.values.lamp_main = 1
        else
            electrics.values.lamp_main = 0
            timer_F = 0
        end
        
        if electrics.values.tlamp_rl == 1 or anyRearDoorOpen or mainTrigger or (timer_R > 0 and timer_R <= delay) then
            electrics.values.lamp_rl = 1
        else
            electrics.values.lamp_rl = 0
            timer_R = 0
        end
        
        if electrics.values.tlamp_rr == 1 or anyRearDoorOpen or mainTrigger or (timer_R > 0 and timer_R <= delay) then
            electrics.values.lamp_rr = 1
        else
            electrics.values.lamp_rr = 0
        end
		
		if anyTailgateOpen or mainTrigger or (timer_TR > 0 and timer_TR <= delay) then
            electrics.values.lamp_trunk = 1
        else
            electrics.values.lamp_trunk = 0
			timer_TR = 0
        end
		
		if anyHoodOpen then
            electrics.values.lamp_frunk = 1
        else
            electrics.values.lamp_frunk = 0
        end
		
		if anyTunnelHatchOpen then
		timer_T = timer_T + dt
			if timer_T >= 3 and anyTunnelHatchOpen then 
				electrics.values.lamp_tunnel = 1
			else
				electrics.values.lamp_tunnel = 0
			end
		else
			timer_T = 0
			electrics.values.lamp_tunnel = 0
		end
    else
        R()
    end
end

-- public interface
M.onInit    = R
M.onReset   = R
M.updateGFX = updateGFX

return M
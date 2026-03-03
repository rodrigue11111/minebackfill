from pint import UnitRegistry

# Single app-wide unit registry
ureg = UnitRegistry()
Q_ = ureg.Quantity

# Example material densities (approximate, placeholders for now)
rho_water = Q_(1000, "kg/m^3")
rho_opc   = Q_(3150, "kg/m^3")   # Ordinary Portland cement
rho_slag  = Q_(2900, "kg/m^3")   # Ground granulated blast-furnace slag
rho_fa    = Q_(2300, "kg/m^3")   # Fly ash

def binder_density(split):
    """
    Weighted density of binder mix (OPC, slag, fly ash).
    split = (opc, slag, fa) with sum = 1.0
    """
    opc, slag, fa = split
    return (opc * rho_opc + slag * rho_slag + fa * rho_fa).to("kg/m^3")

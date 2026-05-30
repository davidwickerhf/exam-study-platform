################################################################################
# Automatically-generated file. Do not edit!
# Toolchain: GNU Tools for STM32 (12.3.rel1)
################################################################################

# Add inputs and outputs from these tool invocations to the build variables 
C_SRCS += \
../Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_dma.c \
../Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_exti.c \
../Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_gpio.c \
../Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_lpgpio.c \
../Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_ucpd.c \
../Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_utils.c 

OBJS += \
./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_dma.o \
./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_exti.o \
./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_gpio.o \
./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_lpgpio.o \
./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_ucpd.o \
./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_utils.o 

C_DEPS += \
./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_dma.d \
./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_exti.d \
./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_gpio.d \
./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_lpgpio.d \
./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_ucpd.d \
./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_utils.d 


# Each subdirectory must supply rules for building sources it contributes
Drivers/STM32U5xx_HAL_Driver/Src/%.o Drivers/STM32U5xx_HAL_Driver/Src/%.su Drivers/STM32U5xx_HAL_Driver/Src/%.cyclo: ../Drivers/STM32U5xx_HAL_Driver/Src/%.c Drivers/STM32U5xx_HAL_Driver/Src/subdir.mk
	arm-none-eabi-gcc "$<" -mcpu=cortex-m33 -std=gnu11 -g3 -DDEBUG -DUSE_FULL_LL_DRIVER -DUSE_HAL_DRIVER -DSTM32U585xx -c -I../Core/Inc -I../Drivers/STM32U5xx_HAL_Driver/Inc -I../Drivers/STM32U5xx_HAL_Driver/Inc/Legacy -I../Drivers/CMSIS/Device/ST/STM32U5xx/Include -I../Drivers/CMSIS/Include -O0 -ffunction-sections -fdata-sections -Wall -fstack-usage -fcyclomatic-complexity -MMD -MP -MF"$(@:%.o=%.d)" -MT"$@" --specs=nano.specs -mfpu=fpv5-sp-d16 -mfloat-abi=hard -mthumb -o "$@"

clean: clean-Drivers-2f-STM32U5xx_HAL_Driver-2f-Src

clean-Drivers-2f-STM32U5xx_HAL_Driver-2f-Src:
	-$(RM) ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_dma.cyclo ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_dma.d ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_dma.o ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_dma.su ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_exti.cyclo ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_exti.d ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_exti.o ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_exti.su ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_gpio.cyclo ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_gpio.d ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_gpio.o ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_gpio.su ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_lpgpio.cyclo ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_lpgpio.d ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_lpgpio.o ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_lpgpio.su ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_ucpd.cyclo ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_ucpd.d ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_ucpd.o ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_ucpd.su ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_utils.cyclo ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_utils.d ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_utils.o ./Drivers/STM32U5xx_HAL_Driver/Src/stm32u5xx_ll_utils.su

.PHONY: clean-Drivers-2f-STM32U5xx_HAL_Driver-2f-Src


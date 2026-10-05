plugins {
    id("com.android.application")
}

android {
    namespace = "ir.daststudio.erp"
    compileSdk = 35

    defaultConfig {
        applicationId = "ir.daststudio.erp"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

                buildConfigField("String", "APP_URL", "\"https://crm-daftar.vercel.app/\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}
